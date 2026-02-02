import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getStockholmDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function rowWeight(row: number): number {
  if (row <= 6) return 6;
  const ways = { 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 } as Record<number, number>;
  return 36 / (ways[row] ?? 1);
}

function calcWeightedProgress(progress: Record<string, boolean[]> | null): number {
  if (!progress) return 0;
  let done = 0;
  let total = 0;
  for (let r = 1; r <= 12; r++) {
    const w = rowWeight(r);
    const row = progress[r] ?? Array(7).fill(false);
    for (let i = 0; i < 7; i++) {
      total += w;
      if (row[i]) done += w;
    }
  }
  return total > 0 ? done / total : 0;
}

function countBoxes(progress: Record<string, boolean[]> | null): number {
  if (!progress) return 0;
  let count = 0;
  for (let r = 1; r <= 12; r++) {
    const row = progress[r] ?? [];
    for (let i = 0; i < 7; i++) if (row[i]) count++;
  }
  return count;
}

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const client = createClient(supabaseUrl, serviceKey);

  const dateKey = getStockholmDateKey();
  const { data: event } = await client
    .from("blitz_events")
    .select("*")
    .eq("date_key", dateKey)
    .maybeSingle();

  if (!event || event.status !== "running") {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
  }

  const { data: participants } = await client
    .from("blitz_participants")
    .select("id, profile_id, player_id, status, eliminated_seq")
    .eq("event_id", event.id);

  const active = (participants ?? []).filter((p) => p.status === "active" && p.player_id);
  if (active.length <= 1) {
    await finalizeBlitz(client, event, participants ?? []);
    return new Response(JSON.stringify({ ok: true, finished: true }), { status: 200 });
  }

  const now = new Date();
  const nextElimAt = event.next_elim_at ? new Date(event.next_elim_at) : null;
  if (nextElimAt && now < nextElimAt) {
    return new Response(JSON.stringify({ ok: true, waiting: true }), { status: 200 });
  }

  const playerIds = active.map((p) => p.player_id);
  const { data: roomState } = await client
    .from("room_state")
    .select("turn_player_id, turn_order, round_counts")
    .eq("room_id", event.room_id)
    .maybeSingle();

  const roundCounts = roomState?.round_counts ?? {};
  const rounds = playerIds.map((id) => Number(roundCounts?.[id] ?? 0));
  const minRound = Math.min(...rounds);
  const maxRound = Math.max(...rounds);
  if (minRound !== maxRound) {
    return new Response(JSON.stringify({ ok: true, waiting: true }), { status: 200 });
  }

  const { data: states } = await client
    .from("player_state")
    .select("player_id, progress")
    .eq("room_id", event.room_id)
    .in("player_id", playerIds);

  const progressByPlayer = new Map((states ?? []).map((s) => [s.player_id, s.progress]));

  const scored = active.map((p) => {
    const prog = progressByPlayer.get(p.player_id) ?? null;
    const weighted = calcWeightedProgress(prog);
    const boxes = countBoxes(prog);
    return {
      participant: p,
      percent: Math.round(weighted * 100),
      boxes,
    };
  });

  const eliminateCount = active.length > 10 && active.length > 4 ? 2 : 1;
  const sorted = [...scored].sort((a, b) => {
    if (a.percent !== b.percent) return a.percent - b.percent;
    if (a.boxes !== b.boxes) return a.boxes - b.boxes;
    return String(a.participant.profile_id).localeCompare(String(b.participant.profile_id));
  });
  const toEliminate = sorted.slice(0, Math.min(eliminateCount, sorted.length - 1));
  if (toEliminate.length === 0) {
    return new Response(JSON.stringify({ ok: true, waiting: true }), { status: 200 });
  }

  const maxSeq = Math.max(0, ...(participants ?? []).map((p) => p.eliminated_seq ?? 0));
  const nextSeq = maxSeq + 1;

  await client
    .from("blitz_participants")
    .update({ status: "eliminated", eliminated_at: now.toISOString(), eliminated_seq: nextSeq })
    .in("id", toEliminate.map((t) => t.participant.id));

  const remaining = active.filter((p) => !toEliminate.some((t) => t.participant.id === p.id));
  const remainingIds = remaining.map((p) => p.player_id);

  if (remaining.length <= 1) {
    await finalizeBlitz(client, event, participants ?? []);
  } else {
    const nextTurnOrder = remainingIds;
    const nextTurn = nextTurnOrder.includes(roomState?.turn_player_id)
      ? roomState.turn_player_id
      : nextTurnOrder[0] ?? null;
    await client.from("room_state").update({
      turn_order: nextTurnOrder,
      turn_player_id: nextTurn,
      updated_at: now.toISOString(),
    }).eq("room_id", event.room_id);

    await client.from("blitz_events").update({
      last_elim_at: now.toISOString(),
      next_elim_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    }).eq("id", event.id);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

async function finalizeBlitz(client: ReturnType<typeof createClient>, event: any, participants: any[]) {
  const active = participants.filter((p) => p.status === "active");
  const eliminated = participants.filter((p) => p.status === "eliminated");
  const maxSeq = Math.max(0, ...eliminated.map((p) => p.eliminated_seq ?? 0));

  let winnerIds = active.map((p) => p.profile_id).filter(Boolean);
  if (winnerIds.length === 0) return;

  const groups: string[][] = [];
  groups.push(winnerIds);

  const bySeq = new Map<number, string[]>();
  eliminated.forEach((p) => {
    const seq = p.eliminated_seq ?? 0;
    const list = bySeq.get(seq) ?? [];
    if (p.profile_id) list.push(p.profile_id);
    bySeq.set(seq, list);
  });

  for (let seq = maxSeq; seq >= 1 && groups.length < 3; seq--) {
    const list = bySeq.get(seq);
    if (list && list.length) groups.push(list);
  }

  const pointsByRank: Record<number, number> = { 1: 10, 2: 5, 3: 3 };
  const pointsByProfile = new Map<string, number>();
  let rank = 1;
  for (const group of groups) {
    if (rank > 3) break;
    const span = Math.min(3, rank + group.length - 1);
    let total = 0;
    for (let r = rank; r <= span; r++) total += pointsByRank[r] ?? 0;
    const per = group.length ? total / group.length : 0;
    group.forEach((id) => pointsByProfile.set(id, per));
    rank += group.length;
  }

  const profileIds = Array.from(pointsByProfile.keys());
  const { data: profiles } = await client
    .from("profiles")
    .select("id, display_name")
    .in("id", profileIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const monthKey = getStockholmDateKey().slice(0, 7);
  const rows = profileIds.map((id) => ({
    match_id: null,
    room_id: event.room_id,
    profile_id: id,
    display_name: nameById.get(id) ?? "Spelare",
    is_winner: false,
    rounds: null,
    points_awarded: pointsByProfile.get(id) ?? 0,
    month_key: monthKey,
  }));

  if (rows.length) {
    await client.from("match_players").insert(rows);
  }

  await client.from("blitz_events").update({
    status: "finished",
    finished_at: new Date().toISOString(),
  }).eq("id", event.id);
}

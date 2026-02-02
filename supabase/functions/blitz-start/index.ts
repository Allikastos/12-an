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

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

  if (!event?.room_id) {
    return new Response(JSON.stringify({ error: "No event" }), { status: 404 });
  }
  if (event.status !== "lobby") {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
  }
  if (event.start_at) {
    const startAt = new Date(event.start_at);
    if (Date.now() < startAt.getTime()) {
      return new Response(JSON.stringify({ ok: true, waiting: true }), { status: 200 });
    }
  }

  const { data: participants } = await client
    .from("blitz_participants")
    .select("profile_id, player_id")
    .eq("event_id", event.id)
    .eq("status", "active");

  const playerIds = (participants ?? []).map((p) => p.player_id).filter(Boolean);
  if (playerIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
  }

  const order = shuffleArray(playerIds);
  const first = order[0] ?? playerIds[0];
  const roundCounts: Record<string, number> = {};
  for (const id of order) roundCounts[id] = 0;

  await client.from("room_state").upsert(
    {
      room_id: event.room_id,
      host_player_id: null,
      started: true,
      turn_player_id: first,
      turn_order: order,
      round_counts: roundCounts,
      finish_triggered: false,
      finish_until_player_id: null,
      finish_until_round: null,
      finish_winner_ids: [],
      match_id: null,
      finalized_at: null,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id" }
  );

  await client.from("blitz_events").update({
    status: "running",
    started_at: new Date().toISOString(),
    next_elim_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  }).eq("id", event.id);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

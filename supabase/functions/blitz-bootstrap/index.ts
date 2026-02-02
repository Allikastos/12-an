import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNotification, setVapidDetails } from "https://deno.land/x/webpush@v0.0.4/mod.ts";

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

function getStockholmOffset(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = tz.match(/GMT([+-]?)(\d+)(?::(\d+))?/);
  if (!match) return "+00:00";
  const sign = match[1] === "-" ? "-" : "+";
  const hours = String(match[2] ?? "0").padStart(2, "0");
  const mins = String(match[3] ?? "0").padStart(2, "0");
  return `${sign}${hours}:${mins}`;
}

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const client = createClient(supabaseUrl, serviceKey);

  const dateKey = getStockholmDateKey();
  const offset = getStockholmOffset();
  const lobbyAtIso = new Date(`${dateKey}T19:45:00${offset}`).toISOString();
  const startAtIso = new Date(`${dateKey}T20:00:00${offset}`).toISOString();
  const now = new Date();
  if (now.getTime() < new Date(lobbyAtIso).getTime()) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
  }

  const { data: existing } = await client
    .from("blitz_events")
    .select("*")
    .eq("date_key", dateKey)
    .maybeSingle();

  let event = existing;
  if (!event) {
    const code = `BLITZ-${dateKey.replace(/-/g, "")}`;
    const { data: room, error: roomErr } = await client
      .from("rooms")
      .insert([{ code }])
      .select("*")
      .single();
    if (roomErr) {
      return new Response(JSON.stringify({ error: roomErr.message }), { status: 500 });
    }

    const { data: created, error: evErr } = await client
      .from("blitz_events")
      .insert([
        {
          date_key: dateKey,
          room_id: room.id,
          status: "lobby",
          lobby_open_at: lobbyAtIso,
          start_at: startAtIso,
        },
      ])
      .select("*")
      .single();
    if (evErr) {
      return new Response(JSON.stringify({ error: evErr.message }), { status: 500 });
    }
    event = created;

    await client.from("room_state").upsert(
      {
        room_id: room.id,
        host_player_id: null,
        started: false,
        turn_player_id: null,
        turn_order: [],
        round_counts: {},
        finish_triggered: false,
        finish_until_player_id: null,
        finish_until_round: null,
        finish_winner_ids: [],
        match_id: null,
        finalized_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id" }
    );
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

  if (vapidPublic && vapidPrivate) {
    try {
      setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
      const { data: subs } = await client
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth");

      const payload = JSON.stringify({
        title: "Kvällsblitz",
        body: "Om 15 minuter börjar kvällsblitz, gå med nu!!",
        url: "https://12-an.vercel.app",
      });

      for (const sub of subs ?? []) {
        try {
          await sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
        } catch (_) {
          // Ignore individual send errors
        }
      }
    } catch (_) {
      // Ignore push setup errors
    }
  }

  return new Response(JSON.stringify({ ok: true, event_id: event?.id ?? null }), { status: 200 });
});

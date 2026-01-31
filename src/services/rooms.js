import { supabase } from "../supabase";

// Skapa rum
export async function createRoomWithCode(code) {
  return supabase
    .from("rooms")
    .insert([{ code }])
    .select("*")
    .single(); // här ska det alltid bli exakt 1
}

// Hämta rum via kod (kan vara 0 rader -> maybeSingle)
export async function getRoomByCode(code) {
  return supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
}

// Hämta spelare via device_id i ett rum (kan vara 0 rader -> maybeSingle)
export async function getPlayerByDevice(roomId, deviceId) {
  return supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .eq("device_id", deviceId)
    .maybeSingle();
}

// Skapa spelare
export async function createPlayer(roomId, name, deviceId, profileId = null) {
  return supabase
    .from("players")
    .insert([
      {
        room_id: roomId,
        name,
        device_id: deviceId,
        profile_id: profileId,
        last_seen: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();
}

// Se till att score-rad finns (ska INTE ge 406 när den inte finns)
export async function ensureScore(roomId, playerId) {
  const { data: existing, error: checkErr } = await supabase
    .from("scores")
    .select("*")
    .eq("room_id", roomId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (checkErr) return { data: null, error: checkErr };
  if (existing) return { data: existing, error: null };

  return supabase
    .from("scores")
    .insert([{ room_id: roomId, player_id: playerId, score: 0 }])
    .select("*")
    .single();
}

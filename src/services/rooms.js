import { supabase } from "../supabase";

export async function createRoomWithCode(code) {
  return supabase.from("rooms").insert({ code }).select().single();
}

export async function getRoomByCode(code) {
  return supabase.from("rooms").select("*").eq("code", code).single();
}

export async function getPlayerByDevice(roomId, deviceId) {
  return supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .eq("device_id", deviceId)
    .single();
}

export async function createPlayer(roomId, name, deviceId) {
  return supabase
    .from("players")
    .insert({ room_id: roomId, name, device_id: deviceId })
    .select()
    .single();
}

export async function ensureScore(roomId, playerId) {
  return supabase
    .from("scores")
    .upsert(
      {
        room_id: roomId,
        player_id: playerId,
        score: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,player_id" }
    );
}

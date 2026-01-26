import { supabase } from "../supabase";

export async function leaveRoom(roomId, playerId) {
  if (!roomId || !playerId) return;

  // Ta bort score först (FK-koppling)
  await supabase
    .from("scores")
    .delete()
    .eq("room_id", roomId)
    .eq("player_id", playerId);

  // Ta bort spelaren
  await supabase
    .from("players")
    .delete()
    .eq("id", playerId);
}

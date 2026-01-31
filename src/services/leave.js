import { supabase } from "../supabase";

export async function leaveRoom(roomId, playerId) {
  if (!roomId || !playerId) return;

  const { data: roomState } = await supabase
    .from("room_state")
    .select("turn_order,turn_player_id,started")
    .eq("room_id", roomId)
    .maybeSingle();

  if (roomState) {
    const order = Array.isArray(roomState.turn_order) ? roomState.turn_order : [];
    const remaining = order.filter((id) => id !== playerId);
    let nextTurn = roomState.turn_player_id;

    if (nextTurn === playerId || (nextTurn && !remaining.includes(nextTurn))) {
      if (remaining.length === 0) {
        nextTurn = null;
      } else {
        const currentIdx = order.indexOf(playerId);
        const baseIdx = currentIdx >= 0 ? currentIdx : order.indexOf(roomState.turn_player_id);
        const startIdx = baseIdx >= 0 ? baseIdx : 0;
        const scan = order.slice(startIdx + 1).concat(order.slice(0, startIdx + 1));
        nextTurn = scan.find((id) => remaining.includes(id)) ?? remaining[0];
      }
    }

    await supabase
      .from("room_state")
      .update({
        turn_order: remaining,
        turn_player_id: nextTurn,
        started: remaining.length ? roomState.started : false,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId);
  }

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

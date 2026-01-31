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
    const roundCounts = { ...(roomState.round_counts ?? {}) };
    delete roundCounts[playerId];
    const winnerIds = Array.isArray(roomState.finish_winner_ids)
      ? roomState.finish_winner_ids.filter((id) => id !== playerId)
      : [];
    let finishUntil = roomState.finish_until_player_id;
    if (finishUntil === playerId) {
      finishUntil = remaining[remaining.length - 1] ?? null;
    }

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
        round_counts: roundCounts,
        finish_winner_ids: winnerIds,
        finish_until_player_id: finishUntil,
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

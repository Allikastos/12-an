import { supabase } from "../supabase";

export async function touchPlayer(playerId) {
  if (!playerId) return;

  await supabase
    .from("players")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", playerId);
}

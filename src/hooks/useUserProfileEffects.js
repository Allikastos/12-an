import { useEffect } from "react";
import { supabase } from "../supabase";

export function useUserProfileEffects({
  userId,
  roomId,
  playerId,
  loadLeaderboardData,
  loadStats,
}) {
  useEffect(() => {
    if (userId && roomId && playerId) {
      supabase.from("players").update({ profile_id: userId }).eq("id", playerId);
    }
  }, [userId, roomId, playerId]);

  useEffect(() => {
    loadLeaderboardData(userId ?? null);
  }, [userId, loadLeaderboardData]);

  useEffect(() => {
    loadStats(userId ?? null);
  }, [userId, loadStats]);
}

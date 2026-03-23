import { useMemo } from "react";
import { calcWeightedProgress, countCompletedRows, emptyProgress, normalizeProgress } from "../lib/appUtils";

export function useRoomDerivedData({
  players,
  playerStates,
  playerId,
  progress,
  roomState,
  isBlitzRoom,
}) {
  const playerSummaries = useMemo(() => {
    return players.map((p) => {
      const ps = playerStates.find((s) => s.player_id === p.id);
      const prog =
        ps?.progress ? normalizeProgress(ps.progress) : p.id === playerId ? progress : emptyProgress();
      const w = calcWeightedProgress(prog);
      const rows = countCompletedRows(prog);
      return {
        id: p.id,
        name: p.name,
        profileId: p.profile_id ?? null,
        percent: Math.round(w * 100),
        rows,
      };
    });
  }, [players, playerStates, playerId, progress]);

  const activeTurnOrder = useMemo(() => {
    return (roomState?.turn_order ?? []).filter((id) => players.some((p) => p.id === id));
  }, [roomState?.turn_order, players]);

  const rematchVotes = useMemo(() => {
    if (!roomState?.rematch_votes || typeof roomState.rematch_votes !== "object") return {};
    return roomState.rematch_votes;
  }, [roomState?.rematch_votes]);

  const rematchVoteCount = useMemo(() => {
    if (!activeTurnOrder.length) return 0;
    return activeTurnOrder.filter((id) => rematchVotes?.[id]).length;
  }, [activeTurnOrder, rematchVotes]);

  const rematchReady = useMemo(() => {
    if (!activeTurnOrder.length) return false;
    return activeTurnOrder.some((id) => rematchVotes?.[id]);
  }, [activeTurnOrder, rematchVotes]);

  const blitzRiskIds = useMemo(() => {
    if (!isBlitzRoom) return new Set();
    const activeCount = playerSummaries.length;
    if (activeCount <= 3) return new Set();
    const eliminateCount = activeCount > 10 ? 2 : 1;
    const sorted = [...playerSummaries].sort((a, b) => {
      if (a.percent !== b.percent) return a.percent - b.percent;
      if (a.rows !== b.rows) return a.rows - b.rows;
      return 0;
    });
    const cutoffIndex = Math.min(eliminateCount, sorted.length - 1) - 1;
    const cutoff = sorted[Math.max(0, cutoffIndex)];
    const risk = sorted.filter(
      (p) => p.percent < cutoff.percent || (p.percent === cutoff.percent && p.rows <= cutoff.rows)
    );
    return new Set((risk.length ? risk : sorted.slice(0, eliminateCount)).map((p) => p.id));
  }, [isBlitzRoom, playerSummaries]);

  return {
    playerSummaries,
    activeTurnOrder,
    rematchVotes,
    rematchVoteCount,
    rematchReady,
    blitzRiskIds,
  };
}

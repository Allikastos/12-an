import { useMemo } from "react";
import { calcWinBonuses, ceilToHalf } from "../lib/appUtils";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

export function useSummaryData({
  roomState,
  playerSummaries,
  players,
  blitzFinished,
  blitzParticipants,
  matchSummary,
  activeTurnOrder,
  showMatchSummary,
  showBlitzSummary,
  matchPlacementsOverride,
  playerId,
  rematchVotes,
}) {
  const matchPlacements = useMemo(() => {
    if (matchPlacementsOverride) return matchPlacementsOverride;
    if (!roomState?.finalized_at) return [];
    const sorted = [...playerSummaries].sort((a, b) => {
      if (a.percent !== b.percent) return b.percent - a.percent;
      if (a.rows !== b.rows) return b.rows - a.rows;
      return a.name.localeCompare(b.name);
    });
    const placements = [];
    let currentRank = 1;
    let prev = null;
    sorted.forEach((p, idx) => {
      if (prev && (p.percent !== prev.percent || p.rows !== prev.rows)) {
        currentRank = idx + 1;
      }
      placements.push({ ...p, rank: currentRank });
      prev = p;
    });
    return placements;
  }, [matchPlacementsOverride, roomState?.finalized_at, playerSummaries]);

  const blitzPlacements = useMemo(() => {
    if (!blitzFinished) return [];
    const participants = (blitzParticipants ?? []).filter((p) => p.profile_id || p.player_id);
    if (!participants.length) return [];

    const active = participants.filter((p) => p.status === "active");
    const eliminated = participants.filter((p) => p.status === "eliminated");
    const eliminatedGroups = new Map();
    eliminated.forEach((p) => {
      const seq = Number(p.eliminated_seq ?? 0);
      const group = eliminatedGroups.get(seq) ?? [];
      group.push(p);
      eliminatedGroups.set(seq, group);
    });
    const orderedElims = Array.from(eliminatedGroups.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, group]) => group);

    const rankGroups = [];
    if (active.length) {
      rankGroups.push(active);
    } else if (orderedElims.length) {
      rankGroups.push(orderedElims.shift() ?? []);
    }
    rankGroups.push(...orderedElims);

    const summaryByProfile = new Map(
      playerSummaries.filter((p) => p.profileId).map((p) => [p.profileId, p])
    );
    const summaryByPlayerId = new Map(playerSummaries.map((p) => [p.id, p]));
    const playerByProfile = new Map(
      players.filter((p) => p.profile_id).map((p) => [p.profile_id, p])
    );
    const playerById = new Map(players.map((p) => [p.id, p]));

    const placements = [];
    let currentRank = 1;
    rankGroups.forEach((group) => {
      group.forEach((entry) => {
        const summary =
          (entry.profile_id && summaryByProfile.get(entry.profile_id)) ??
          (entry.player_id && summaryByPlayerId.get(entry.player_id));
        const player =
          (entry.profile_id && playerByProfile.get(entry.profile_id)) ??
          (entry.player_id && playerById.get(entry.player_id));
        placements.push({
          id: entry.player_id ?? entry.profile_id ?? `${currentRank}-${Math.random()}`,
          name: summary?.name ?? player?.name ?? "Spelare",
          profileId: entry.profile_id ?? player?.profile_id ?? null,
          percent: summary?.percent ?? 0,
          rows: summary?.rows ?? 0,
          rank: currentRank,
        });
      });
      currentRank += group.length;
    });

    return placements;
  }, [blitzFinished, blitzParticipants, playerSummaries, players]);

  const blitzPointsByProfile = useMemo(() => {
    if (!blitzPlacements.length) return new Map();
    const pointsByRank = { 1: 10, 2: 5, 3: 3 };
    const map = new Map();
    let idx = 0;
    while (idx < blitzPlacements.length) {
      const rank = blitzPlacements[idx].rank;
      const group = blitzPlacements.filter((p) => p.rank === rank);
      if (rank > 3) break;
      const span = Math.min(3, rank + group.length - 1);
      let total = 0;
      for (let r = rank; r <= span; r++) total += pointsByRank[r] ?? 0;
      const per = group.length ? total / group.length : 0;
      group.forEach((p) => map.set(p.profileId ?? p.id, per));
      idx += group.length;
    }
    return map;
  }, [blitzPlacements]);

  const finalizedAt = roomState?.finalized_at ?? null;
  const finishWinnerIds = useMemo(
    () => roomState?.finish_winner_ids ?? EMPTY_ARRAY,
    [roomState?.finish_winner_ids]
  );
  const roundCounts = useMemo(
    () => roomState?.round_counts ?? EMPTY_OBJECT,
    [roomState?.round_counts]
  );

  const matchPointsFallback = useMemo(() => {
    const byProfile = new Map();
    const byName = new Map();
    if (!finalizedAt) return { byProfile, byName };
    if (!finishWinnerIds.length) return { byProfile, byName };
    const totalPlayers = activeTurnOrder.length;
    const totalPoints = Math.max(1, 1 + 0.5 * Math.max(0, totalPlayers - 2));
    const pointsPerWinner = ceilToHalf(totalPoints / finishWinnerIds.length);
    players.forEach((p) => {
      const isWinner = finishWinnerIds.includes(p.id);
      const roundsUsed = typeof roundCounts[p.id] === "number" ? roundCounts[p.id] : null;
      const bonus = isWinner && roundsUsed != null ? calcWinBonuses(roundsUsed) : 0;
      const points = p.profile_id ? (isWinner ? pointsPerWinner + bonus : 0) : 0;
      if (p.profile_id) byProfile.set(p.profile_id, points);
      if (p.name) byName.set(p.name, points);
    });
    return { byProfile, byName };
  }, [finalizedAt, finishWinnerIds, roundCounts, activeTurnOrder, players]);

  const matchPointsByProfile = useMemo(() => {
    if (matchSummary?.rows?.length) {
      const map = new Map();
      (matchSummary?.rows ?? []).forEach((r) => {
        if (r.profile_id) map.set(r.profile_id, r.points_awarded ?? 0);
      });
      return map;
    }
    return matchPointsFallback.byProfile;
  }, [matchSummary?.rows, matchPointsFallback.byProfile]);

  const matchPointsByName = useMemo(() => {
    if (matchSummary?.rows?.length) {
      const map = new Map();
      (matchSummary?.rows ?? []).forEach((r) => {
        if (r.display_name) map.set(r.display_name, r.points_awarded ?? 0);
      });
      return map;
    }
    return matchPointsFallback.byName;
  }, [matchSummary?.rows, matchPointsFallback.byName]);

  const showSummary = showMatchSummary || showBlitzSummary;
  const summaryTitle = showBlitzSummary ? "Blitz – resultat" : "Matchresultat";
  const summaryRows = showBlitzSummary ? blitzPlacements : matchPlacements;
  const hasVotedRematch = Boolean(rematchVotes?.[playerId ?? ""]);

  return {
    matchPlacements,
    blitzPlacements,
    blitzPointsByProfile,
    matchPointsByProfile,
    matchPointsByName,
    showSummary,
    summaryTitle,
    summaryRows,
    hasVotedRematch,
  };
}

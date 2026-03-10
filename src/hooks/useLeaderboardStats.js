import { useCallback, useState } from "react";
import { supabase } from "../supabase";
import { getMonthKeySweden, getPreviousMonthKeySweden } from "../lib/appUtils";

export function useLeaderboardStats() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [kingHistory, setKingHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isKing, setIsKing] = useState(false);
  const [isKingReady, setIsKingReady] = useState(false);

  const loadLeaderboardData = useCallback(async (currentUserId) => {
    const monthKey = getMonthKeySweden();
    const { data: rows } = await supabase
      .from("match_players")
      .select("profile_id, display_name, points_awarded, month_key")
      .eq("month_key", monthKey)
      .not("profile_id", "is", null);

    const totals = new Map();
    (rows ?? []).forEach((r) => {
      const id = r.profile_id;
      if (!id) return;
      const existing = totals.get(id) ?? { id, name: r.display_name ?? "Spelare", points: 0 };
      existing.points += r.points_awarded ?? 0;
      totals.set(id, existing);
    });

    const list = Array.from(totals.values()).sort((a, b) => b.points - a.points);
    setLeaderboard(list);

    const { data: historyRows } = await supabase
      .from("match_players")
      .select("profile_id, display_name, points_awarded, month_key")
      .not("profile_id", "is", null)
      .order("month_key", { ascending: false })
      .limit(2000);

    const byMonth = new Map();
    (historyRows ?? []).forEach((r) => {
      if (!r.month_key || !r.profile_id) return;
      const key = r.month_key;
      const entry = byMonth.get(key) ?? new Map();
      const prev = entry.get(r.profile_id) ?? { id: r.profile_id, name: r.display_name ?? "Spelare", points: 0 };
      prev.points += r.points_awarded ?? 0;
      entry.set(r.profile_id, prev);
      byMonth.set(key, entry);
    });

    const history = Array.from(byMonth.entries())
      .map(([month, map]) => {
        const top = Array.from(map.values()).sort((a, b) => b.points - a.points)[0];
        return { month, winner: top };
      })
      .filter((item) => item.winner)
      .sort((a, b) => (a.month < b.month ? 1 : -1));

    setKingHistory(history);
    const previousMonthKey = getPreviousMonthKeySweden();
    const previousMonthWinner = history.find((h) => h.month === previousMonthKey)?.winner ?? null;
    const currentLeaderId = list[0]?.id ?? null;
    if (!currentUserId) {
      setIsKing(false);
      setIsKingReady(true);
      return;
    }
    const currentUserKey = currentUserId != null ? String(currentUserId) : null;
    const leaderKey = currentLeaderId != null ? String(currentLeaderId) : null;
    const prevKey = previousMonthWinner?.id != null ? String(previousMonthWinner.id) : null;
    const eligibleKing = Boolean(currentUserKey && (currentUserKey === leaderKey || currentUserKey === prevKey));
    setIsKing(eligibleKing);
    setIsKingReady(true);
  }, []);

  const loadStats = useCallback(async (userId) => {
    if (!userId) {
      setStats(null);
      return;
    }
    const { data: myRows } = await supabase
      .from("match_players")
      .select("match_id, is_winner, rounds, points_awarded, display_name, month_key")
      .eq("profile_id", userId);

    const matches = new Set();
    let wins = 0;
    let blitzWins = 0;
    let totalRounds = 0;
    let winRoundsCount = 0;
    let fastestWinRounds = null;

    (myRows ?? []).forEach((r) => {
      const isNormal = Boolean(r.match_id);
      if (isNormal) matches.add(r.match_id);
      if (r.is_winner) {
        if (isNormal) {
          wins += 1;
          if (typeof r.rounds === "number") {
            totalRounds += r.rounds;
            winRoundsCount += 1;
            if (fastestWinRounds == null || r.rounds < fastestWinRounds) {
              fastestWinRounds = r.rounds;
            }
          }
        } else {
          blitzWins += 1;
        }
      }
    });

    const matchCount = matches.size;
    const avgRoundsToWin = winRoundsCount ? totalRounds / winRoundsCount : null;
    const winRatio = matchCount ? wins / matchCount : null;

    let mostBeaten = null;
    if (wins > 0) {
      const winMatchIds = (myRows ?? []).filter((r) => r.is_winner).map((r) => r.match_id);
      if (winMatchIds.length) {
        const { data: opponentRows } = await supabase
          .from("match_players")
          .select("display_name, match_id, profile_id")
          .in("match_id", winMatchIds)
          .neq("profile_id", userId);
        const counts = new Map();
        (opponentRows ?? []).forEach((r) => {
          const key = r.display_name ?? "Spelare";
          counts.set(key, (counts.get(key) ?? 0) + 1);
        });
        const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
        if (best) mostBeaten = { name: best[0], wins: best[1] };
      }
    }

    const kingCount = kingHistory.filter((k) => k.winner?.id === userId).length;

    setStats({
      wins,
      blitzWins,
      matchCount,
      winRatio,
      avgRoundsToWin,
      fastestWinRounds,
      mostBeaten,
      kingCount,
    });
  }, [kingHistory]);

  return {
    leaderboard,
    kingHistory,
    stats,
    isKing,
    isKingReady,
    loadLeaderboardData,
    loadStats,
  };
}

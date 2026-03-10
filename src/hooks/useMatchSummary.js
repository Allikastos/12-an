import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export function useMatchSummary({
  roomState,
  isSolo,
  blitzFinished,
  blitzEventId,
  isBlitzRoom,
  blitzParticipated,
}) {
  const [matchSummary, setMatchSummary] = useState(null);
  const [showMatchSummary, setShowMatchSummary] = useState(false);
  const [showBlitzSummary, setShowBlitzSummary] = useState(false);
  const [dismissedMatchId, setDismissedMatchId] = useState(null);
  const [dismissedBlitzId, setDismissedBlitzId] = useState(null);

  const matchSummaryKey = useMemo(
    () => roomState?.match_id ?? (roomState?.finalized_at ? `final:${roomState.finalized_at}` : null),
    [roomState?.match_id, roomState?.finalized_at]
  );

  const loadMatchSummary = useCallback(async (matchId) => {
    if (!matchId) {
      setMatchSummary(null);
      return;
    }
    const { data, error } = await supabase
      .from("match_players")
      .select("profile_id, display_name, points_awarded, is_winner")
      .eq("match_id", matchId);
    if (error) {
      console.error("match summary load failed", error);
      return;
    }
    setMatchSummary({ matchId, rows: data ?? [] });
    setShowMatchSummary(true);
  }, []);

  useEffect(() => {
    if (!roomState?.finalized_at || isSolo) {
      queueMicrotask(() => {
        setMatchSummary(null);
        setShowMatchSummary(false);
      });
      return;
    }
    if (dismissedMatchId === matchSummaryKey) return;
    if (roomState?.match_id) {
      queueMicrotask(() => {
        void loadMatchSummary(roomState.match_id);
      });
      return;
    }
    queueMicrotask(() => {
      setShowMatchSummary(true);
    });
  }, [roomState?.match_id, roomState?.finalized_at, dismissedMatchId, isSolo, matchSummaryKey, loadMatchSummary]);

  useEffect(() => {
    if (!blitzFinished || !blitzEventId || !isBlitzRoom || !blitzParticipated) {
      queueMicrotask(() => {
        setShowBlitzSummary(false);
      });
      return;
    }
    if (dismissedBlitzId === blitzEventId) return;
    queueMicrotask(() => {
      setShowBlitzSummary(true);
    });
  }, [blitzFinished, blitzEventId, dismissedBlitzId, isBlitzRoom, blitzParticipated]);

  const closeSummary = useCallback(() => {
    if (showMatchSummary && matchSummaryKey) {
      setDismissedMatchId(matchSummaryKey);
    }
    if (showBlitzSummary && blitzEventId) {
      setDismissedBlitzId(blitzEventId);
    }
    setShowMatchSummary(false);
    setShowBlitzSummary(false);
  }, [showMatchSummary, matchSummaryKey, showBlitzSummary, blitzEventId]);

  return {
    matchSummary,
    showMatchSummary,
    setShowMatchSummary,
    showBlitzSummary,
    setShowBlitzSummary,
    dismissedMatchId,
    setDismissedMatchId,
    dismissedBlitzId,
    matchSummaryKey,
    closeSummary,
  };
}

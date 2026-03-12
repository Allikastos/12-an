import { useEffect } from "react";

export function useMatchLifecycleEffects({
  roomStartedAt,
  prevStartedAtRef,
  resetProgress,
  resetTurnState,
  setShowMatchSummary,
  setDismissedMatchId,
  roomFinalizedAt,
  isSolo,
  rematchReady,
  rematchStartingRef,
  startRematch,
  forceTick,
}) {
  useEffect(() => {
    if (!roomStartedAt) return;
    if (prevStartedAtRef.current && prevStartedAtRef.current !== roomStartedAt) {
      resetProgress();
      resetTurnState();
      setShowMatchSummary(false);
      setDismissedMatchId(null);
    }
    prevStartedAtRef.current = roomStartedAt;
  }, [
    roomStartedAt,
    prevStartedAtRef,
    resetProgress,
    resetTurnState,
    setShowMatchSummary,
    setDismissedMatchId,
  ]);

  useEffect(() => {
    if (!roomFinalizedAt || isSolo) return;
    if (!rematchReady) return;
    if (rematchStartingRef.current) return;
    void startRematch();
  }, [roomFinalizedAt, rematchReady, isSolo, rematchStartingRef, startRematch]);

  useEffect(() => {
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [forceTick]);
}

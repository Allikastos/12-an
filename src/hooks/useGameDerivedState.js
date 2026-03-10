import { useMemo } from "react";
import { calcWeightedProgress, computeLocks } from "../lib/appUtils";

export function useGameDerivedState({
  progress,
  dice,
  diceStatus,
  targetLocked,
  roomState,
  players,
  isSolo,
  gameStarted,
  isMyTurn,
}) {
  const TOTAL_BOXES = 12 * 7;

  const completedBoxes = useMemo(() => {
    let count = 0;
    for (let r = 1; r <= 12; r++) {
      const row = progress?.[r] ?? [];
      for (let i = 0; i < 7; i++) if (row[i]) count++;
    }
    return count;
  }, [progress]);

  const completedRows = useMemo(() => {
    let rows = 0;
    for (let r = 1; r <= 12; r++) {
      const row = progress?.[r] ?? [];
      if (row.length === 7 && row.every(Boolean)) rows++;
    }
    return rows;
  }, [progress]);

  const weightedProgress = useMemo(() => calcWeightedProgress(progress), [progress]);
  const weightedPercent = Math.round(weightedProgress * 100);

  const fullRows = useMemo(() => {
    const set = new Set();
    for (let r = 1; r <= 12; r++) {
      const row = progress?.[r] ?? [];
      if (row.length === 7 && row.every(Boolean)) set.add(r);
    }
    return set;
  }, [progress]);

  const availableTargets = useMemo(() => {
    if (diceStatus !== "choose" || targetLocked) return [];
    const list = [];
    for (let n = 1; n <= 12; n++) {
      if (fullRows.has(n)) continue;
      const { gain } = computeLocks(dice, Array(6).fill(false), n);
      if (gain > 0) list.push(n);
    }
    return list;
  }, [diceStatus, targetLocked, dice, fullRows]);

  const activePlayer = useMemo(() => {
    if (!roomState?.turn_player_id) return null;
    return players.find((p) => p.id === roomState.turn_player_id) ?? null;
  }, [roomState, players]);

  const canAct = isSolo ? true : gameStarted && isMyTurn;
  const shouldBlinkEdge = canAct && diceStatus === "idle";

  return {
    TOTAL_BOXES,
    completedBoxes,
    completedRows,
    weightedProgress,
    weightedPercent,
    fullRows,
    availableTargets,
    activePlayer,
    canAct,
    shouldBlinkEdge,
  };
}

import { useEffect } from "react";
import { supabase } from "../supabase";

export function useGameplayEffects({
  isSolo,
  gameStarted,
  isMyTurn,
  setMiniSolitaireCloseSignal,
  prevIsMyTurnRef,
  isBlitzRoom,
  userId,
  playerId,
  blitzEventId,
  blitzJoined,
  loadBlitzParticipants,
  prevShowDiceRef,
  settingsShowDice,
  setSettings,
  diceStatus,
  targetLocked,
  availableTargetsLength,
  setDiceStatus,
  setTarget,
  setPreviewLocked,
  setLastGain,
  followActivePlayer,
  activePlayerId,
  setInspectPlayerId,
  setShowInspect,
  showChat,
  markChatOpened,
  roomTurnPlayerId,
  resetTurnState,
  turnTimeoutRef,
  lastTurnActionRef,
  endRound,
  settingsVibrateOnTurn,
  setTurnFlash,
  turnFlash,
  shouldBlinkEdge,
}) {
  useEffect(() => {
    if (!isSolo && gameStarted && isMyTurn && !prevIsMyTurnRef.current) {
      setMiniSolitaireCloseSignal((v) => v + 1);
    }
    prevIsMyTurnRef.current = Boolean(isMyTurn);
  }, [isSolo, gameStarted, isMyTurn, prevIsMyTurnRef, setMiniSolitaireCloseSignal]);

  useEffect(() => {
    if (!isBlitzRoom || !userId || !playerId || !blitzEventId) return;
    if (blitzJoined) return;
    let cancelled = false;
    (async () => {
      await supabase.from("blitz_participants").upsert(
        {
          event_id: blitzEventId,
          profile_id: userId,
          player_id: playerId,
          status: "active",
          joined_at: new Date().toISOString(),
        },
        { onConflict: "event_id,profile_id" }
      );
      if (!cancelled) await loadBlitzParticipants(blitzEventId);
    })();
    return () => {
      cancelled = true;
    };
  }, [isBlitzRoom, userId, playerId, blitzEventId, blitzJoined, loadBlitzParticipants]);

  useEffect(() => {
    if (!isBlitzRoom) {
      if (prevShowDiceRef.current != null) {
        setSettings((s) => ({ ...s, showDice: prevShowDiceRef.current }));
        prevShowDiceRef.current = null;
      }
      return;
    }
    if (prevShowDiceRef.current == null) {
      prevShowDiceRef.current = settingsShowDice;
    }
    if (!settingsShowDice) {
      setSettings((s) => ({ ...s, showDice: true }));
    }
  }, [isBlitzRoom, settingsShowDice, prevShowDiceRef, setSettings]);

  useEffect(() => {
    if (diceStatus === "choose" && !targetLocked && availableTargetsLength === 0) {
      setDiceStatus("stopped");
      setTarget(null);
      setPreviewLocked(Array(6).fill(false));
      setLastGain(0);
    }
  }, [diceStatus, targetLocked, availableTargetsLength, setDiceStatus, setTarget, setPreviewLocked, setLastGain]);

  useEffect(() => {
    if (followActivePlayer && activePlayerId) {
      setInspectPlayerId(activePlayerId);
    }
  }, [followActivePlayer, activePlayerId, setInspectPlayerId]);

  useEffect(() => {
    if (isSolo || !followActivePlayer) return;
    if (isMyTurn) {
      setShowInspect(false);
      return;
    }
    setShowInspect(true);
  }, [followActivePlayer, isMyTurn, isSolo, setShowInspect]);

  useEffect(() => {
    if (showChat) markChatOpened();
  }, [showChat, markChatOpened]);

  useEffect(() => {
    if (!gameStarted) return;
    if (roomTurnPlayerId) {
      resetTurnState();
    }
  }, [roomTurnPlayerId, gameStarted, resetTurnState]);

  useEffect(() => {
    if (!isBlitzRoom || isSolo || !gameStarted || !isMyTurn) {
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
      return;
    }
    lastTurnActionRef.current = Date.now();
    if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
    turnTimeoutRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastTurnActionRef.current;
      if (elapsed < 15000) return;
      if (!isMyTurn || !isBlitzRoom || isSolo || !gameStarted) return;
      endRound();
    }, 15000);
    return () => {
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
    };
  }, [gameStarted, isMyTurn, isSolo, isBlitzRoom, turnTimeoutRef, lastTurnActionRef, endRound]);

  useEffect(() => {
    if (!gameStarted || !isMyTurn) return;
    if (!settingsVibrateOnTurn) return;
    setTurnFlash(true);
    const t = setTimeout(() => setTurnFlash(false), 1500);
    return () => clearTimeout(t);
  }, [gameStarted, isMyTurn, settingsVibrateOnTurn, setTurnFlash]);

  useEffect(() => {
    if (turnFlash) {
      document.body.classList.add("turn-flash");
    } else {
      document.body.classList.remove("turn-flash");
    }
    return () => document.body.classList.remove("turn-flash");
  }, [turnFlash]);

  useEffect(() => {
    if (shouldBlinkEdge) {
      document.body.classList.add("turn-waiting");
    } else {
      document.body.classList.remove("turn-waiting");
    }
    return () => document.body.classList.remove("turn-waiting");
  }, [shouldBlinkEdge]);
}

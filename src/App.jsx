import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { leaveRoom } from "./services/leave";

import { Container } from "./ui/Container";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

import ScoreSheet from "./components/ScoreSheet";
import DiceTray, { DieFace } from "./components/DiceTray";
import MiniSolitaire from "./components/MiniSolitaire";
import HarpanThemeBackground from "./components/HarpanThemeBackground";
import { createDefaultSettings } from "./config/defaultSettings";
import { BG_PATTERNS } from "./config/themes";
import {
  makeCode,
  sanitizeRoomCode,
  getOrCreateDeviceId,
  emptyProgress,
  isProgressWin,
  shuffleArray,
  getMonthKeySweden,
  calcWinBonuses,
  computeLocks,
  rollDie,
} from "./lib/appUtils";
import { useAuthProfile } from "./hooks/useAuthProfile";
import { useSettingsEffects } from "./hooks/useSettingsEffects";
import { useAppBootstrapParams } from "./hooks/useAppBootstrapParams";
import { useRoomGameState } from "./hooks/useRoomGameState";
import { useBlitzLifecycle } from "./hooks/useBlitzLifecycle";
import { useLeaderboardStats } from "./hooks/useLeaderboardStats";
import { useFriendsInvites } from "./hooks/useFriendsInvites";
import { useChatRoom } from "./hooks/useChatRoom";
import { useAppNotifications } from "./hooks/useAppNotifications";
import { useRoomRealtime } from "./hooks/useRoomRealtime";
import { useMatchSummary } from "./hooks/useMatchSummary";
import { useSummaryData } from "./hooks/useSummaryData";
import { useRoomDerivedData } from "./hooks/useRoomDerivedData";
import { useThemeManager } from "./hooks/useThemeManager";
import { useGameDerivedState } from "./hooks/useGameDerivedState";
import { useRoomRestoreSession } from "./hooks/useRoomRestoreSession";
import { useGameplayEffects } from "./hooks/useGameplayEffects";
import { useMatchLifecycleEffects } from "./hooks/useMatchLifecycleEffects";
import { useUserProfileEffects } from "./hooks/useUserProfileEffects";

import {
  createRoomWithCode,
  getRoomByCode,
  getPlayerByDevice,
  createPlayer,
  ensureScore,
} from "./services/rooms";



export default function App() {
  const [deviceId] = useState(() => getOrCreateDeviceId());

  const {
    leaderboard,
    kingHistory,
    stats,
    isKing,
    isKingReady,
    loadLeaderboardData,
    loadStats,
  } = useLeaderboardStats();
  const [showKingHistory, setShowKingHistory] = useState(false);

  const [step, setStep] = useState("home"); // home | room | solo
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [showInspect, setShowInspect] = useState(false);
  const [inspectPlayerId, setInspectPlayerId] = useState(null);
  const {
    user,
    profile,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authName,
    setAuthName,
    authError,
    authLoading,
    handleSignUp,
    handleSignIn,
    handleSignOut,
  } = useAuthProfile({ name, setName });
  const {
    friends,
    friendRequests,
    friendSearch,
    setFriendSearch,
    friendResults,
    friendStats,
    roomInvites,
    sentInvites,
    searchProfiles,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    loadFriendStatsFor,
    sendRoomInvite,
    acceptRoomInvite,
    declineRoomInvite,
  } = useFriendsInvites({ userId: user?.id ?? null, roomId, kingHistory, joinRoom });
  const {
    chatMessages,
    chatInput,
    setChatInput,
    chatUnread,
    chatToasts,
    loadChat,
    sendChat: sendChatMessage,
    handleIncomingMessage,
    markChatOpened,
  } = useChatRoom();
  const { players, playerStates } = useRoomRealtime({
    roomId,
    setRoomState,
    loadChat,
    handleIncomingMessage,
  });

  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem("scoreboard_settings_v1");
      return raw ? JSON.parse(raw) : createDefaultSettings();
    } catch {
      return createDefaultSettings();
    }
  });

  useSettingsEffects({ settings, setSettings });

  useUserProfileEffects({
    userId: user?.id ?? null,
    roomId,
    playerId,
    loadLeaderboardData,
    loadStats,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);
  const [followActivePlayer, setFollowActivePlayer] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [showBlitzInfo, setShowBlitzInfo] = useState(false);
  const [showPlayMenu, setShowPlayMenu] = useState(false);
  const [advancedTab, setAdvancedTab] = useState("colors");
  const [personalThemeName, setPersonalThemeName] = useState("");
  const [themeCategory, setThemeCategory] = useState("standard");
  const [showDiceStyles, setShowDiceStyles] = useState(false);
  const {
    blitzEvent,
    blitzParticipants,
    blitzNow,
    blitzLobbyOpen,
    blitzStartsIn,
    blitzRunning,
    blitzFinished,
    blitzElimIn,
    blitzEliminationRound,
    loadBlitzParticipants,
    ensureBlitzEvent,
  } = useBlitzLifecycle();
  const {
    showInstallHelp,
    setShowInstallHelp,
    installPrompt,
    isStandalone,
    toggleNotifyTurn,
    toggleNotifyInvite,
    toggleNotifyBlitz,
    installAsApp,
  } = useAppNotifications({
    userId: user?.id ?? null,
    settings,
    setSettings,
    roomState,
    playerId,
    roomInvites,
  });
  const [blitzJoinError, setBlitzJoinError] = useState(null);
  const [startGameBusy, setStartGameBusy] = useState(false);
  const [startGameError, setStartGameError] = useState(null);
  const prevShowDiceRef = useRef(null);
  const [showChat, setShowChat] = useState(false);
  const [authNotice, setAuthNotice] = useState(null);
  const [selectedStandingPlayerId, setSelectedStandingPlayerId] = useState(null);
  const [miniSolitaireCloseSignal, setMiniSolitaireCloseSignal] = useState(0);
  const turnTimeoutRef = useRef(null);
  const prevIsMyTurnRef = useRef(false);
  const lastTurnActionRef = useRef(0);
  const autoEndWinRef = useRef(false);
  const rematchStartingRef = useRef(false);
  const rematchSupportedRef = useRef(true);
  const prevStartedAtRef = useRef(null);
  const {
    themes,
    kingLocked,
    themeSnapshot,
    applyTheme,
    isThemeLocked,
    getThemeLockReason,
    applyPersonalTheme,
    savePersonalTheme,
    deletePersonalTheme,
  } = useThemeManager({
    settings,
    setSettings,
    isKingReady,
    isKing,
    stats,
    user,
    personalThemeName,
    setPersonalThemeName,
  });
  useAppBootstrapParams({
    sanitizeRoomCode,
    setRoomCode,
    themes,
    applyTheme,
    setAuthNotice,
  });
  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  const outgoingRequestIds = useMemo(
    () => new Set(friendRequests.outgoing.map((r) => r.addressee?.id).filter(Boolean)),
    [friendRequests.outgoing]
  );
  const standardThemes = useMemo(
    () => themes.filter((theme) => (theme.category ?? "standard") === "standard"),
    [themes]
  );
  const specialThemes = useMemo(
    () => themes.filter((theme) => (theme.category ?? "standard") === "special"),
    [themes]
  );
  const visibleThemes = themeCategory === "special" ? specialThemes : standardThemes;
  const isSolo = step === "solo";
  const gameStarted = isSolo ? true : Boolean(roomState?.started);
  const isMyTurn = isSolo
    ? true
    : gameStarted &&
      String(roomState?.turn_player_id ?? "") === String(playerId ?? "");
  const isBlitzRoom = Boolean(
    roomId &&
      ((blitzEvent?.room_id && roomId === blitzEvent.room_id) ||
        (roomCode && roomCode.toUpperCase().startsWith("BLITZ-")))
  );

  const blitzActiveCount = blitzParticipants.filter((p) => p.status === "active").length;
  const blitzEliminatedCount = blitzParticipants.filter((p) => p.status === "eliminated").length;
  const blitzJoined = Boolean(
    user?.id && blitzParticipants.some((p) => p.profile_id === user.id && p.status === "active")
  );
  const blitzParticipated = Boolean(
    user?.id && blitzParticipants.some((p) => p.profile_id === user.id)
  );
  const {
    matchSummary,
    showMatchSummary,
    setShowMatchSummary,
    showBlitzSummary,
    setDismissedMatchId,
    closeSummary,
  } = useMatchSummary({
    roomState,
    isSolo,
    blitzFinished,
    blitzEventId: blitzEvent?.id ?? null,
    isBlitzRoom,
    blitzParticipated,
  });
  const turnTimeLeft = useMemo(() => {
    if (!isBlitzRoom || isSolo || !gameStarted || !isMyTurn) return null;
    const last = lastTurnActionRef.current || Date.now();
    const elapsed = Math.floor((blitzNow.getTime() - last) / 1000);
    return Math.max(0, 15 - elapsed);
  }, [blitzNow, isBlitzRoom, isSolo, gameStarted, isMyTurn]);

  const progressStorageKey = useMemo(() => {
    if (roomId && playerId) return `t12_progress_${roomId}_${playerId}`;
    return "t12_progress_local";
  }, [roomId, playerId]);

  const [progress, setProgress] = useState(() => emptyProgress());
  const [showWin, setShowWin] = useState(false);
  const [hasSignaledWin, setHasSignaledWin] = useState(false);

  // Dice state (optional)
  const [dice, setDice] = useState(() => Array(6).fill(1));
  const [locked, setLocked] = useState(() => Array(6).fill(false));
  const [previewLocked, setPreviewLocked] = useState(() => Array(6).fill(false));
  const [target, setTarget] = useState(null); // 1..12, null until chosen
  const [lastGain, setLastGain] = useState(0);
  const [diceStatus, setDiceStatus] = useState("idle"); // idle | choose | running | stopped | all
  const [mustCommitSelection, setMustCommitSelection] = useState(false);
  const [targetLocked, setTargetLocked] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollNonce, setRollNonce] = useState(0);
  const [diceHitFlash, setDiceHitFlash] = useState(() => Array(6).fill(false));
  const rollTimerRef = useRef(null);
  const rollHitTimerRef = useRef(null);
  const rollAudioCtxRef = useRef(null);
  const [turnFlash, setTurnFlash] = useState(false);
  const finalizeGuardRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(progressStorageKey);
      const p = raw ? JSON.parse(raw) : emptyProgress();
      setProgress(p);
      setShowWin(isProgressWin(p));
    } catch {
      const p = emptyProgress();
      setProgress(p);
      setShowWin(false);
    }
  }, [progressStorageKey]);

  useEffect(() => {
    localStorage.setItem(progressStorageKey, JSON.stringify(progress));
  }, [progress, progressStorageKey]);

  useEffect(() => {
    if (isSolo || !gameStarted) return;
    if (!hasSignaledWin && isProgressWin(progress)) {
      setHasSignaledWin(true);
      signalWin();
      if (isMyTurn && !autoEndWinRef.current) {
        autoEndWinRef.current = true;
        endRound();
      }
    }
  }, [progress, isSolo, gameStarted, hasSignaledWin, isMyTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!gameStarted) {
      setHasSignaledWin(false);
      autoEndWinRef.current = false;
    }
  }, [gameStarted]);

  useEffect(() => {
    if (!roomId || !playerId) return;
    const payload = {
      room_id: roomId,
      player_id: playerId,
      progress,
      last_dice: dice,
      last_target: target,
      theme_snapshot: themeSnapshot,
      updated_at: new Date().toISOString(),
    };
    (async () => {
      const { error } = await supabase
        .from("player_state")
        .upsert(payload, { onConflict: "room_id,player_id" });
      if (error) {
        console.error("player_state upsert failed", error);
      }
    })();
  }, [roomId, playerId, progress, dice, target, themeSnapshot]);

  const resetTurnState = () => {
    setDiceStatus("idle");
    setMustCommitSelection(false);
    setTarget(null);
    setLocked(Array(6).fill(false));
    setPreviewLocked(Array(6).fill(false));
    setLastGain(0);
    setTargetLocked(false);
  };

  const {
    TOTAL_BOXES,
    completedBoxes,
    completedRows,
    weightedPercent,
    fullRows,
    availableTargets,
    activePlayer,
    canAct,
    shouldBlinkEdge,
  } = useGameDerivedState({
    progress,
    dice,
    diceStatus,
    targetLocked,
    roomState,
    players,
    isSolo,
    gameStarted,
    isMyTurn,
  });

  useGameplayEffects({
    isSolo,
    gameStarted,
    isMyTurn,
    setMiniSolitaireCloseSignal,
    prevIsMyTurnRef,
    isBlitzRoom,
    userId: user?.id ?? null,
    playerId,
    blitzEventId: blitzEvent?.id ?? null,
    blitzJoined,
    loadBlitzParticipants,
    prevShowDiceRef,
    settingsShowDice: settings.showDice,
    setSettings,
    diceStatus,
    targetLocked,
    availableTargetsLength: availableTargets.length,
    setDiceStatus,
    setTarget,
    setPreviewLocked,
    setLastGain,
    followActivePlayer,
    activePlayerId: activePlayer?.id ?? null,
    setInspectPlayerId,
    setShowInspect,
    showChat,
    markChatOpened,
    roomTurnPlayerId: roomState?.turn_player_id ?? null,
    resetTurnState,
    turnTimeoutRef,
    lastTurnActionRef,
    endRound,
    settingsVibrateOnTurn: settings.vibrateOnTurn,
    setTurnFlash,
    turnFlash,
    shouldBlinkEdge,
  });

  const sendChat = useCallback(() => {
    const senderName = (name.trim() || profile?.display_name || authName || "Spelare").trim();
    void sendChatMessage({
      roomId,
      userId: user?.id ?? null,
      playerId: playerId ?? null,
      senderName,
    });
  }, [name, profile?.display_name, authName, sendChatMessage, roomId, user?.id, playerId]);

  const playRollFeedback = useCallback(() => {
    if (settings.diceHaptics && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(22);
    }
    if (!settings.diceSound || typeof window === "undefined") return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = rollAudioCtxRef.current ?? new Ctx();
      rollAudioCtxRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const start = ctx.currentTime;
      [900, 760, 620].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start + idx * 0.045);
        gain.gain.setValueAtTime(0.0001, start + idx * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.025, start + idx * 0.045 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + idx * 0.045 + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start + idx * 0.045);
        osc.stop(start + idx * 0.045 + 0.085);
      });
    } catch {
      // Ignore feedback errors (autoplay policies etc).
    }
  }, [settings.diceHaptics, settings.diceSound]);

  const triggerDiceHitFlash = useCallback((indices) => {
    if (!Array.isArray(indices) || indices.length === 0) return;
    const next = Array(6).fill(false);
    indices.forEach((i) => {
      if (i >= 0 && i < 6) next[i] = true;
    });
    setDiceHitFlash(next);
    if (rollHitTimerRef.current) clearTimeout(rollHitTimerRef.current);
    rollHitTimerRef.current = setTimeout(() => setDiceHitFlash(Array(6).fill(false)), 520);
  }, []);

  const triggerRollAnimation = () => {
    playRollFeedback();
    setRollNonce((n) => n + 1);
    setRolling(true);
    if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    rollTimerRef.current = setTimeout(() => setRolling(false), 560);
  };

  useEffect(() => {
    return () => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
      if (rollHitTimerRef.current) clearTimeout(rollHitTimerRef.current);
    };
  }, []);

  const {
    playerSummaries,
    activeTurnOrder,
    rematchVotes,
    rematchVoteCount,
    rematchReady,
    blitzRiskIds,
  } = useRoomDerivedData({
    players,
    playerStates,
    playerId,
    progress,
    roomState,
    isBlitzRoom,
  });

  const {
    blitzPointsByProfile,
    matchPointsByProfile,
    matchPointsByName,
    showSummary,
    summaryTitle,
    summaryRows,
    hasVotedRematch,
  } = useSummaryData({
    roomState,
    playerSummaries,
    players,
    blitzFinished,
    blitzParticipants,
    matchSummary,
    activeTurnOrder,
    showMatchSummary,
    showBlitzSummary,
    playerId,
    rematchVotes,
  });

  const [, forceTick] = useState(0);

  useRoomRestoreSession({
    deviceId,
    name,
    setName,
    setRoomCode,
    setRoomId,
    setPlayerId,
    setStep,
  });

  useMatchLifecycleEffects({
    roomStartedAt: roomState?.started_at ?? null,
    prevStartedAtRef,
    resetProgress,
    resetTurnState,
    setShowMatchSummary,
    setDismissedMatchId,
    roomFinalizedAt: roomState?.finalized_at ?? null,
    isSolo,
    rematchReady,
    rematchStartingRef,
    startRematch,
    forceTick,
  });

  const joinCodeReady = useMemo(() => roomCode.length === 6, [roomCode]);
  const canJoin = useMemo(() => {
    const hasName = name.trim().length >= 2 || Boolean(profile?.display_name || authName);
    return roomCode.length === 6 && hasName;
  }, [roomCode, name, profile?.display_name, authName]);

  async function createRoom() {
    const code = makeCode(6);
    const { error } = await createRoomWithCode(code);
    if (error) return alert(error.message);

    setRoomCode(code);
    await joinRoom(code);
  }

  async function joinRoomWithRoom(room, codeOverride = "") {
    const playerName = (name.trim() || profile?.display_name || authName || "").trim();

    let player = null;
    const { data: existing, error: existingErr } = await getPlayerByDevice(room.id, deviceId);

    if (!existingErr && existing) {
      player = existing;
      if (playerName && playerName !== player.name) {
        await supabase.from("players").update({ name: playerName }).eq("id", player.id);
        player = { ...player, name: playerName };
      }
      if (user?.id && !player.profile_id) {
        await supabase.from("players").update({ profile_id: user.id }).eq("id", player.id);
        player = { ...player, profile_id: user.id };
      }
    } else {
      const { data: created, error: playerErr } = await createPlayer(
        room.id,
        playerName,
        deviceId,
        user?.id ?? null
      );
      if (playerErr) return { room: null, player: null, error: playerErr };
      player = created;
    }

    const { error: scoreErr } = await ensureScore(room.id, player.id);
    if (scoreErr) return { room: null, player: null, error: scoreErr };

    await supabase.from("player_state").upsert(
      {
        room_id: room.id,
        player_id: player.id,
        progress: emptyProgress(),
        last_dice: [],
        last_target: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,player_id" }
    );

    const { data: rs } = await supabase
      .from("room_state")
      .select("*")
      .eq("room_id", room.id)
      .maybeSingle();

    if (rs?.started) {
      const order = rs.turn_order ?? [];
      if (!order.includes(player.id)) {
        await supabase
          .from("room_state")
          .update({
            turn_order: [...order, player.id],
            updated_at: new Date().toISOString(),
          })
          .eq("room_id", room.id);
      }
    }

    localStorage.setItem("scoreboard_room_code", codeOverride || room.code || "");
    localStorage.setItem("scoreboard_room_id", room.id);
    localStorage.setItem("scoreboard_player_id", player.id);

    setRoomCode((codeOverride || room.code || "").toUpperCase());
    setRoomId(room.id);
    setPlayerId(player.id);
    setStep("room");

    return { room, player, error: null };
  }

  async function joinRoom(codeParam) {
    const code = (codeParam ?? roomCode).trim().toUpperCase();

    const { data: room, error: roomErr } = await getRoomByCode(code);
    if (roomErr || !room) return alert("Rummet hittades inte. Kontrollera koden.");

    const { error } = await joinRoomWithRoom(room, code);
    if (error) return alert(error.message);
  }

  async function joinBlitz() {
    setBlitzJoinError(null);
    if (!user?.id) {
      setBlitzJoinError("Du måste vara inloggad för Blitz.");
      return;
    }
    if (!blitzLobbyOpen) {
      setBlitzJoinError("Blitz är inte öppet ännu.");
      return;
    }
    let event = blitzEvent;
    if (!event?.room_id || !event?.id) {
      event = await ensureBlitzEvent();
    }
    if (!event?.room_id || !event?.id) {
      setBlitzJoinError("Blitz-rummet hittades inte.");
      return;
    }
    const { data: room } = await supabase.from("rooms").select("*").eq("id", event.room_id).maybeSingle();
    if (!room) {
      setBlitzJoinError("Blitz-rummet hittades inte.");
      return;
    }
    const { player, error } = await joinRoomWithRoom(room, room.code || "BLITZ");
    if (error || !player) {
      setBlitzJoinError(error?.message ?? "Kunde inte gå med i Blitz.");
      return;
    }
    await supabase.from("blitz_participants").upsert(
      {
        event_id: event.id,
        profile_id: user.id,
        player_id: player.id,
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "event_id,profile_id" }
    );
    await loadBlitzParticipants(event.id);
  }

  function shareRoomLink() {
    if (!roomCode) return;
    const url = `${window.location.origin}?room=${roomCode}`;
    const text = `Kom och spela 12:an! Rumskod: ${roomCode} Länk: ${url}`;
    if (navigator.share) {
      navigator.share({ title: "12:an", text, url }).catch(() => {});
      return;
    }
    window.location.href = `sms:&body=${encodeURIComponent(text)}`;
  }

  async function handleLeave() {
    if (!window.confirm("Vill du lämna rummet?")) return;
    if (!window.confirm("Är du helt säker att du vill lämna?")) return;
    try {
      await leaveRoom(roomId, playerId);
    } finally {
      localStorage.removeItem("scoreboard_room_code");
      localStorage.removeItem("scoreboard_room_id");
      localStorage.removeItem("scoreboard_player_id");
      window.location.reload();
    }
  }

  const { upsertRoomStateSafe, updateRoomStateSafe } = useRoomGameState({
    roomId,
    playerId,
    setRoomState,
    rematchSupportedRef,
  });

  async function ensurePlayerIdForRoom() {
    if (playerId) return playerId;
    if (!roomId) return null;
    const stored = localStorage.getItem("scoreboard_player_id");
    if (stored) {
      setPlayerId(stored);
      return stored;
    }
    const { data: existing } = await getPlayerByDevice(roomId, deviceId);
    if (existing?.id) {
      setPlayerId(existing.id);
      localStorage.setItem("scoreboard_player_id", existing.id);
      return existing.id;
    }
    return null;
  }

  async function startGame() {
    if (isBlitzRoom) return;
    if (startGameBusy) return;
    setStartGameBusy(true);
    setStartGameError(null);
    try {
      if (!roomId) {
        alert("Rummet saknas. Gå tillbaka och gå in igen.");
        return;
      }
      const currentPlayerId = playerId ?? (await ensurePlayerIdForRoom());
      if (!currentPlayerId) {
        alert("Kunde inte hitta din spelare i rummet. Gå ut och gå in igen.");
        return;
      }
      if (roomState?.started) return;
      const { data: latestPlayers, error: playersErr } = await supabase
        .from("players")
        .select("id")
        .eq("room_id", roomId);
      if (playersErr) {
        alert("Kunde inte hämta spelare. Försök igen.");
        return;
      }
      const ids = (latestPlayers ?? []).map((p) => p.id);
      if (!ids.length) {
        alert("Inga spelare i rummet ännu.");
        return;
      }
      const hostId =
        roomState?.host_player_id && ids.includes(roomState.host_player_id)
          ? roomState.host_player_id
          : currentPlayerId;
      const order = shuffleArray(ids);
      const first = order[0] ?? currentPlayerId;
      const roundCounts = order.reduce((acc, id) => {
        acc[id] = 0;
        return acc;
      }, {});
      roundCounts[first] = (roundCounts[first] ?? 0) + 1;

      const payload = {
        room_id: roomId,
        host_player_id: hostId,
        started: true,
        turn_player_id: first,
        turn_order: order,
        round_counts: roundCounts,
        finish_triggered: false,
        finish_until_player_id: null,
        finish_until_round: null,
        finish_winner_ids: [],
        rematch_votes: {},
        match_id: null,
        finalized_at: null,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error: startErr } = await upsertRoomStateSafe(payload, {
        onConflict: "room_id",
      });

      if (startErr) {
        console.error("startGame failed", startErr);
        const msg = startErr.message ?? "Kunde inte starta spelet.";
        setStartGameError(msg);
        alert(msg);
        return;
      }
      if (updated) setRoomState(updated);
    } catch (err) {
      console.error("startGame failed", err);
      const msg = err?.message ?? "Kunde inte starta spelet.";
      setStartGameError(msg);
      alert(msg);
    } finally {
      setStartGameBusy(false);
    }
  }

  async function voteRematch() {
    if (!roomId || !playerId) return;
    if (!rematchSupportedRef.current) return;
    const nextVotes = { ...(roomState?.rematch_votes ?? {}) };
    nextVotes[playerId] = true;
    await updateRoomStateSafe({ rematch_votes: nextVotes, updated_at: new Date().toISOString() });
  }

  async function startRematch() {
    if (!roomId || !playerId || !players.length) return;
    if (rematchStartingRef.current) return;
    rematchStartingRef.current = true;
    const now = new Date().toISOString();
    try {
      await supabase
        .from("player_state")
        .update({
          progress: emptyProgress(),
          last_dice: null,
          last_target: null,
          updated_at: now,
        })
        .eq("room_id", roomId);

      await updateRoomStateSafe({
        started: false,
        turn_player_id: null,
        turn_order: roomState?.turn_order ?? [],
        round_counts: {},
        finish_triggered: false,
        finish_until_player_id: null,
        finish_until_round: null,
        finish_winner_ids: [],
        rematch_votes: {},
        match_id: null,
        finalized_at: null,
        updated_at: now,
      });

      resetProgress();
      resetTurnState();
      setShowMatchSummary(false);
      setDismissedMatchId(null);
      await startGame();
    } finally {
      rematchStartingRef.current = false;
    }
  }

  async function advanceTurn(roundCountsOverride) {
    if (!roomState?.turn_order?.length) return;
    const activeOrder = (roomState.turn_order ?? []).filter((id) =>
      players.some((p) => p.id === id)
    );
    if (!activeOrder.length) return;
    const current = activeOrder.includes(roomState.turn_player_id)
      ? roomState.turn_player_id
      : activeOrder[0];
    const idx = Math.max(0, activeOrder.indexOf(current));
    const next = activeOrder[(idx + 1) % activeOrder.length] ?? current;
    const baseCounts = roundCountsOverride ?? roomState?.round_counts ?? {};
    const nextCounts = {
      ...baseCounts,
      [next]: (baseCounts?.[next] ?? 0) + 1,
    };

    const { data: updated } = await supabase
      .from("room_state")
      .update({
        turn_player_id: next,
        turn_order: activeOrder,
        round_counts: nextCounts,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .select("*")
      .single();

    if (updated) setRoomState(updated);
  }

  function toggleCell(row, idx) {
    if (settings.showDice) return;
    markTurnActivity();
    setProgress((prev) => {
      const base = prev && typeof prev === "object" ? prev : emptyProgress();
      const next = { ...base, [row]: [...(base[row] ?? Array(7).fill(false))] };
      next[row][idx] = !next[row][idx];

      const won = isProgressWin(next);
      setShowWin(won);

      return next;
    });
  }

  function resetProgress() {
    const p = emptyProgress();
    setProgress(p);
    setShowWin(false);
  }

  function confirmReset() {
    if (!window.confirm("Vill du verkligen återställa hela spelet?")) return;
    resetProgress();
  }

  function markTurnActivity() {
    if (!isBlitzRoom || isSolo || !gameStarted) return;
    if (!isMyTurn) return;
    lastTurnActionRef.current = Date.now();
    if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
    turnTimeoutRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastTurnActionRef.current;
      if (elapsed < 15000) return;
      if (!isMyTurn || !isBlitzRoom || isSolo || !gameStarted) return;
      endRound();
    }, 15000);
  }

  function setTargetSafe(value) {
    if (targetLocked) return;
    if (fullRows.has(value)) return;
    markTurnActivity();
    if (diceStatus === "choose") {
      const { nextLocked } = computeLocks(dice, Array(6).fill(false), value);
      const lockedCount = nextLocked.filter(Boolean).length;
      const gained = value >= 7 ? Math.floor(lockedCount / 2) : lockedCount;
      if (gained <= 0) return;
      addToProgress(value, gained);
      triggerDiceHitFlash(nextLocked.map((v, i) => (v ? i : -1)).filter((i) => i >= 0));
      setMustCommitSelection(false);
      setTarget(value);
      setTargetLocked(true);
      setLocked(nextLocked);
      setPreviewLocked(nextLocked);
      setLastGain(gained);
      const rowFilled = ((progress?.[value] ?? []).filter(Boolean).length + gained) >= 7;
      if (rowFilled) {
        resetTurnState();
        return;
      }
      setDiceStatus(nextLocked.every(Boolean) ? "all" : "running");
      return;
    }

    setTarget(value);
    setLocked(Array(6).fill(false));
    setLastGain(0);
    setPreviewLocked(Array(6).fill(false));
  }

  function rerollAll() {
    markTurnActivity();
    triggerRollAnimation();
    setDice(Array(6).fill(0).map(() => rollDie()));
    setDiceStatus("choose");
    setMustCommitSelection(true);
    setTarget(null);
    setTargetLocked(false);
    setLocked(Array(6).fill(false));
    setPreviewLocked(Array(6).fill(false));
    setLastGain(0);
  }

  function addToProgress(val, count) {
    if (!val || count <= 0) return;
    setProgress((prev) => {
      const base = prev && typeof prev === "object" ? prev : emptyProgress();
      const row = base[val] ?? Array(7).fill(false);
      let filled = row.filter(Boolean).length;
      const nextRow = [...row];
      for (let i = filled; i < Math.min(7, filled + count); i++) {
        nextRow[i] = true;
      }
      const next = { ...base, [val]: nextRow };
      const won = isProgressWin(next);
      setShowWin(won);
      return next;
    });
  }

  function rollOnce() {
    markTurnActivity();
    if (mustCommitSelection) return;
    if (diceStatus === "all") {
      rerollAll();
      return;
    }
    if (diceStatus === "stopped") return;
    if (diceStatus === "idle") {
      triggerRollAnimation();
      const firstDice = Array(6).fill(0).map(() => rollDie());
      setDice(firstDice);
      setLocked(Array(6).fill(false));
      setPreviewLocked(Array(6).fill(false));
      setLastGain(0);
      setDiceStatus("choose");
      setMustCommitSelection(true);
      setTargetLocked(false);
      return;
    }

    if (!target) return;

    if (diceStatus === "choose") {
      setTargetLocked(true);
    }

    triggerRollAnimation();
    const baseLocked =
      diceStatus === "choose"
        ? computeLocks(dice, locked, target).nextLocked
        : locked;
    if (diceStatus === "choose") {
      setPreviewLocked(baseLocked);
    }
    const nextDice = dice.map((d, i) => (baseLocked[i] ? d : rollDie()));
    const { nextLocked, gain } = computeLocks(nextDice, baseLocked, target);
    const newlyLocked = nextLocked
      .map((isLockedNow, i) => (isLockedNow && !baseLocked[i] ? i : -1))
      .filter((i) => i >= 0);

    const isTwoDiceTarget = target >= 7;
    let addedCount = 0;
    if (diceStatus === "choose") {
      const lockedCount = baseLocked.filter(Boolean).length;
      const initialCount = isTwoDiceTarget ? Math.floor(lockedCount / 2) : lockedCount;
      addedCount = initialCount + gain;
      addToProgress(target, addedCount);
    } else if (gain > 0) {
      addedCount = gain;
      addToProgress(target, addedCount);
    }

    setDice(nextDice);
    setLocked(nextLocked);
    setPreviewLocked(nextLocked);
    setLastGain(gain);
    triggerDiceHitFlash(newlyLocked);

    const rowFilled =
      target &&
      (() => {
        const current = (progress?.[target] ?? []).filter(Boolean).length;
        return current + addedCount >= 7;
      })();

    if (nextLocked.every(Boolean)) {
      setDiceStatus("all");
      setTargetLocked(true);
      return;
    }

    if (rowFilled) {
      resetTurnState();
      return;
    }

    if (gain === 0) {
      setDiceStatus("stopped");
    } else {
      // Force a new value selection after each successful roll.
      // This prevents endless rerolls without committing a target.
      setDiceStatus("choose");
      setMustCommitSelection(true);
      setTarget(null);
      setTargetLocked(false);
      setLocked(Array(6).fill(false));
      setPreviewLocked(Array(6).fill(false));
    }
  }

  async function signalWin() {
    if (!roomId || !playerId || !roomState?.started) return;
    const order = roomState.turn_order ?? [];
    const finishUntil = roomState.finish_until_player_id ?? order[order.length - 1] ?? playerId;
    const baseCounts = roomState.round_counts ?? {};
    const finishUntilRound = Math.max(1, baseCounts[playerId] ?? 1);
    const winners = new Set(roomState.finish_winner_ids ?? []);
    winners.add(playerId);

    const { data: updated } = await supabase
      .from("room_state")
      .update({
        finish_triggered: true,
        finish_until_player_id: finishUntil,
        finish_until_round: finishUntilRound,
        finish_winner_ids: Array.from(winners),
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .select("*")
      .single();
    if (updated) setRoomState(updated);
  }

  const finalizeMatch = useCallback(async (roundCountsOverride) => {
    if (!roomId || !roomState || roomState.finalized_at) return;
    const order = roomState.turn_order ?? [];
    if (!order.length) return;
    const winners = roomState.finish_winner_ids ?? [];
    if (!winners.length) return;

    const totalPlayers = order.length;
    const totalPoints = Math.max(1, 1 + 0.5 * Math.max(0, totalPlayers - 2));
    const pointsPerWinner = Math.ceil(totalPoints / winners.length);
    const monthKey = getMonthKeySweden();
    const endedAt = new Date().toISOString();

    const { data: match, error } = await supabase
      .from("matches")
      .insert([
        {
          room_id: roomId,
          ended_at: endedAt,
          month_key: monthKey,
          total_players: totalPlayers,
          winners_count: winners.length,
        },
      ])
      .select("*")
      .single();

    if (error || !match) {
      console.error("match insert failed", error);
      await updateRoomStateSafe({
        started: false,
        turn_player_id: null,
        rematch_votes: {},
        finalized_at: endedAt,
        updated_at: endedAt,
      });
      return;
    }

    const roundCounts = roundCountsOverride ?? roomState.round_counts ?? {};
    const playersById = new Map(players.map((p) => [p.id, p]));

    const rows = order.map((id) => {
      const p = playersById.get(id);
      const isWinner = winners.includes(id);
      const roundsUsed = typeof roundCounts[id] === "number" ? roundCounts[id] : null;
      const bonus = isWinner && roundsUsed != null ? calcWinBonuses(roundsUsed) : 0;
      const basePoints = isWinner ? pointsPerWinner : 0;
      const pointsAwarded = (p?.profile_id ? basePoints + bonus : 0);

      return {
        match_id: match.id,
        room_id: roomId,
        profile_id: p?.profile_id ?? null,
        display_name: p?.name ?? "Spelare",
        is_winner: isWinner,
        rounds: roundsUsed,
        points_awarded: pointsAwarded,
        month_key: monthKey,
      };
    });

    const { error: mpErr } = await supabase.from("match_players").insert(rows);
    if (mpErr) console.error("match_players insert failed", mpErr);

    const { data: updated } = await updateRoomStateSafe({
      started: false,
      turn_player_id: null,
      match_id: match.id,
      finalized_at: endedAt,
      rematch_votes: {},
      updated_at: endedAt,
    });
    if (updated) setRoomState(updated);
    await loadLeaderboardData(user?.id ?? null);
    if (user?.id) await loadStats(user.id);
  }, [
    roomId,
    roomState,
    players,
    updateRoomStateSafe,
    user,
    loadLeaderboardData,
    loadStats,
  ]);

  function endRound() {
    resetTurnState();
    if (!isMyTurn) return;
    (async () => {
      const counts = roomState?.round_counts ?? {};
      const activeOrder = (roomState?.turn_order ?? []).filter((id) =>
        players.some((p) => p.id === id)
      );
      const finishUntilRound = roomState?.finish_until_round ?? null;
      const reachedFinishRound =
        finishUntilRound != null &&
        activeOrder.every((id) => (counts?.[id] ?? 0) >= finishUntilRound);
      const isFinalTurn = roomState?.finish_triggered && (reachedFinishRound || activeOrder.length <= 1);
      if (isFinalTurn) {
        await supabase
          .from("room_state")
          .update({
            round_counts: counts,
            updated_at: new Date().toISOString(),
          })
          .eq("room_id", roomId);
        await finalizeMatch(counts);
        return;
      }
      await advanceTurn(counts);
      if (isBlitzRoom) {
        try {
          await supabase.functions.invoke("blitz-tick");
        } catch (err) {
          console.error("blitz-tick invoke failed", err);
        }
      }
    })();
  }

  useEffect(() => {
    if (isSolo || isBlitzRoom) return;
    if (!roomState?.finish_triggered || roomState?.finalized_at) return;
    if (roomState?.host_player_id && roomState.host_player_id !== playerId) return;
    const counts = roomState?.round_counts ?? {};
    const activeOrder = (roomState?.turn_order ?? []).filter((id) =>
      players.some((p) => p.id === id)
    );
    if (!activeOrder.length) return;
    const finishUntilRound = roomState?.finish_until_round ?? null;
    if (finishUntilRound == null) return;
    const reachedFinishRound = activeOrder.every((id) => (counts?.[id] ?? 0) >= finishUntilRound);
    if (!reachedFinishRound) return;
    if (finalizeGuardRef.current) return;
    finalizeGuardRef.current = true;
    finalizeMatch(counts).finally(() => {
      finalizeGuardRef.current = false;
    });
  }, [
    isSolo,
    isBlitzRoom,
    roomState?.finish_triggered,
    roomState?.finalized_at,
    roomState?.finish_until_round,
    roomState?.round_counts,
    roomState?.turn_order,
    roomState?.host_player_id,
    players,
    playerId,
    finalizeMatch,
  ]);

  const settingsSectionStyle = {
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,.26)",
    background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)",
  };
  const settingsSectionTitleStyle = {
    color: "#c7d2fe",
    fontWeight: 900,
    marginBottom: 10,
    letterSpacing: 0.2,
    fontSize: 12,
    textTransform: "uppercase",
  };
  const settingsInlineRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,.2)",
    background: "rgba(15,23,42,.36)",
  };
  const settingsLinkButtonStyle = {
    marginTop: 10,
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  };
  const showHarpanThemeVideo = settings.themeKey === "Harpan";

  if (step === "home") {
    return (
      <>
        <HarpanThemeBackground active={showHarpanThemeVideo} />
        <Container>
          <Card style={{ padding: 22, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <img
              src="/12-an-hemskarm-logotyp.png"
              alt="12:an"
              style={{
                width: 210,
                height: 66,
                objectFit: "contain",
                borderRadius: 0,
                border: "none",
                boxShadow: "none",
                marginLeft: -40,
              }}
            />
            <Button
              variant="ghost"
              onClick={() => setShowAuthPanel((v) => !v)}
              style={{ width: "auto", padding: "6px 10px", borderRadius: 999, fontSize: 12 }}
              aria-label="Konto"
            >
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                  position: "relative",
                }}
              >
                👤
                {friendRequests.incoming.length > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -6,
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      borderRadius: 999,
                      background: "#ef4444",
                      color: "white",
                      fontSize: 10,
                      fontWeight: 800,
                      display: "grid",
                      placeItems: "center",
                      border: "2px solid rgba(8,12,20,.9)",
                    }}
                  >
                    {friendRequests.incoming.length}
                  </span>
                )}
              </span>
            </Button>
          </div>

          {showAuthPanel && (
            <div
              style={{
                position: "absolute",
                top: 56,
                right: 16,
                width: "min(360px, calc(100% - 32px))",
                padding: 12,
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "rgba(8,12,20,.92)",
                backdropFilter: "blur(8px)",
                display: "grid",
                gap: 10,
                zIndex: 10,
              }}
            >
              {authNotice && (
                <div
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid rgba(34,197,94,.35)",
                    background: "rgba(34,197,94,.12)",
                    fontWeight: 800,
                    color: "#bbf7d0",
                  }}
                >
                  {authNotice}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAuthPanel(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Stäng
                </button>
              </div>
              {user ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>
                    {profile?.display_name ?? "Spelare"}
                    <div style={{ color: "var(--muted)", fontWeight: 600 }}>{user.email}</div>
                  </div>
                  {stats && (
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,.02)",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>Din statistik</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{stats.wins}</div>
                          <div style={{ color: "var(--muted)", fontWeight: 700 }}>vinster</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 900 }}>{stats.blitzWins ?? 0}</div>
                          <div style={{ color: "var(--muted)", fontWeight: 700 }}>blitzvinster</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {stats.winRatio != null ? stats.winRatio.toFixed(2) : "—"}
                          </div>
                          <div style={{ color: "var(--muted)", fontWeight: 700 }}>vinster / match</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {stats.avgRoundsToWin ? stats.avgRoundsToWin.toFixed(1) : "—"}
                          </div>
                          <div style={{ color: "var(--muted)", fontWeight: 700 }}>rundor per vinst</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {stats.fastestWinRounds != null ? stats.fastestWinRounds : "—"}
                          </div>
                          <div style={{ color: "var(--muted)", fontWeight: 700 }}>snabbaste vinst</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 900 }}>{stats.kingCount}</div>
                          <div style={{ color: "var(--muted)", fontWeight: 700 }}>king‑titlar</div>
                        </div>
                      </div>
                      <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                        Vinner mest mot:{" "}
                        {stats.mostBeaten ? `${stats.mostBeaten.name} (${stats.mostBeaten.wins})` : "—"}
                      </div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setShowFriendsPanel(true)}
                    style={{ width: "auto" }}
                  >
                    Vänner
                  </Button>
                  <Button variant="ghost" onClick={handleSignOut}>
                    Logga ut
                  </Button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <Input
                    placeholder="E-post"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Lösenord"
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                  <Input
                    placeholder="Visningsnamn"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                  {authError && <div style={{ color: "salmon", fontWeight: 700 }}>{authError}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Button onClick={handleSignIn} disabled={authLoading}>
                      Logga in
                    </Button>
                    <Button variant="ghost" onClick={handleSignUp} disabled={authLoading}>
                      Skapa konto
                    </Button>
                  </div>
                  <div style={{ color: "var(--muted)", fontWeight: 600 }}>
                    Gäster får inga poäng eller statistik.
                  </div>
                  <Button variant="ghost" onClick={() => setShowFriendsPanel(true)} style={{ width: "auto" }}>
                    Vänner
                  </Button>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <label style={{ display: "block", color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
              Ditt namn
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <Button
              onClick={() => setShowPlayMenu(true)}
              style={{
                background:
                  "linear-gradient(135deg, rgba(34,197,94,.95), rgba(16,185,129,.92))",
                color: "#0b1220",
                fontWeight: 900,
                boxShadow: "0 12px 26px rgba(34,197,94,.32), 0 0 0 1px rgba(255,255,255,.12)",
              }}
            >
              Spela
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep("solo")}
              style={{
                background:
                  "linear-gradient(135deg, rgba(250,204,21,.95), rgba(34,197,94,.95) 70%)",
                color: "#1f2937",
                fontWeight: 900,
                border: "1px solid rgba(250,204,21,.55)",
                boxShadow:
                  "0 16px 32px rgba(250,204,21,.32), 0 0 0 1px rgba(255,255,255,.18)",
              }}
            >
              Poängblad
            </Button>
          </div>

          {showPlayMenu && (
            <div
              onClick={() => setShowPlayMenu(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.68)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 60,
              }}
            >
              <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 100%)" }}>
                <Card style={{ padding: 18, background: "rgba(8,12,20,.985)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <h3 style={{ margin: 0 }}>Spela</h3>
                    <Button variant="ghost" style={{ width: "auto" }} onClick={() => setShowPlayMenu(false)}>
                      Stäng
                    </Button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <div
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 12,
                        background: "rgba(255,255,255,.07)",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>Skapa nytt rum</div>
                      <Button
                        onClick={() => {
                          setShowPlayMenu(false);
                          void createRoom();
                        }}
                      >
                        Skapa rum
                      </Button>
                    </div>

                    <div
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 12,
                        background: "rgba(255,255,255,.07)",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>Joina befintligt rum</div>
                      <Input
                        value={roomCode}
                        onChange={(e) => setRoomCode(sanitizeRoomCode(e.target.value))}
                        placeholder="t.ex. A1B2C3"
                        style={{ textTransform: "uppercase" }}
                      />
                      <Button
                        variant={joinCodeReady ? "primary" : "ghost"}
                        onClick={() => {
                          void joinRoom();
                        }}
                        disabled={!canJoin}
                      >
                        Joina rum
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {roomInvites.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,.02)",
                display: "grid",
                gap: 8,
              }}
            >
              {roomInvites.slice(0, 1).map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {inv.sender?.display_name ?? "Spelare"} – {inv.roomCode || "—"}
                  </div>
                  <Button
                    onClick={() => acceptRoomInvite(inv)}
                    style={{ width: "auto", padding: "6px 10px" }}
                  >
                    Gå med
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => declineRoomInvite(inv.id)}
                    style={{ width: "auto", padding: "6px 10px" }}
                  >
                    Neka
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(234,179,8,.45)",
              background:
                "linear-gradient(135deg, rgba(234,179,8,.14), rgba(56,189,248,.08) 55%, rgba(15,23,42,.05))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900 }}>Blitz 20:00</div>
                <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                  Startar om {blitzStartsIn}
                </div>
                <div style={{ color: blitzLobbyOpen ? "#fde68a" : "var(--muted)", fontWeight: 800 }}>
                  {blitzRunning
                    ? "Pågår nu"
                    : blitzFinished
                    ? "Avslutad"
                    : blitzLobbyOpen
                    ? "Anmälan öppen (19:45–20:00)"
                    : "Anmälan öppnar 19:45"}
                </div>
                {blitzEliminationRound && (
                  <div style={{ color: "#f87171", fontWeight: 900 }}>ELIMINERINGSRUNDA!!</div>
                )}
                {blitzEvent?.award_points === false && (
                  <div style={{ color: "#fbbf24", fontWeight: 800 }}>Testläge – inga poäng delas ut</div>
                )}
                <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                  Aktiva: {blitzActiveCount} {blitzEliminatedCount ? `• Utslagna: ${blitzEliminatedCount}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Button
                  variant="ghost"
                  onClick={() => setShowBlitzInfo(true)}
                  style={{ width: "auto", whiteSpace: "nowrap" }}
                >
                  Regler
                </Button>
                <Button
                  variant={blitzLobbyOpen && user?.id ? "primary" : "ghost"}
                  onClick={joinBlitz}
                  disabled={!blitzLobbyOpen || !user?.id}
                  style={{ width: "auto", whiteSpace: "nowrap" }}
                >
                  {blitzJoined ? "Du är med" : blitzLobbyOpen ? "Gå med" : "Väntar..."}
                </Button>
              </div>
            </div>
            {blitzJoinError && (
              <div style={{ marginTop: 8, color: "salmon", fontWeight: 700 }}>{blitzJoinError}</div>
            )}
            {!user?.id && (
              <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 600 }}>
                Event kräver inloggning.
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {!isStandalone && installPrompt && (
              <Button variant="ghost" onClick={() => setShowInstallHelp(true)}>
                Lägg till som app
              </Button>
            )}
            {!isStandalone && !installPrompt && (
              <div style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>
                För iPhone: installera via Dela → Lägg till på hemskärmen.
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(245, 215, 123, .45)",
              background: "rgba(255,255,255,.02)",
              boxShadow: "0 0 0 1px rgba(245, 215, 123, .12)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800 }}>King of the Month</div>
              {leaderboard[0] && (
                <div style={{ fontWeight: 800, color: "var(--accent)" }}>
                  King: {leaderboard[0].name}
                </div>
              )}
            </div>
            {leaderboard.length === 0 && (
              <div style={{ color: "var(--muted)" }}>Inga poäng ännu denna månad.</div>
            )}
            {leaderboard.slice(0, 5).map((p, idx) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: idx === 0 ? "rgba(245,158,11,.12)" : "transparent",
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  #{idx + 1} {p.name}
                </div>
                <div style={{ fontWeight: 900 }}>{Math.ceil(Number(p.points) || 0)}</div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setShowKingHistory((v) => !v)}
              style={{
                marginTop: 6,
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                fontWeight: 800,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {showKingHistory ? "Dölj tidigare kings" : "Visa tidigare kings"}
            </button>
            {showKingHistory && (
              <div style={{ display: "grid", gap: 6 }}>
                {kingHistory.slice(0, 12).map((k) => (
                  <div key={k.month} style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>{k.month}</div>
                    <div style={{ fontWeight: 700 }}>{k.winner?.name}</div>
                  </div>
                ))}
                {kingHistory.length === 0 && (
                  <div style={{ color: "var(--muted)" }}>Ingen historik ännu.</div>
                )}
              </div>
            )}
          </div>

          {showFriendsPanel && (
            <div
              onClick={() => setShowFriendsPanel(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.68)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 60,
              }}
            >
              <div onClick={(e) => e.stopPropagation()} style={{ width: "min(860px, 100%)" }}>
                <Card
                  style={{
                    padding: 18,
                    maxHeight: "82vh",
                    overflow: "auto",
                    background: "rgba(8,12,20,.98)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <h3 style={{ margin: 0 }}>Vänner</h3>
                    <Button variant="ghost" style={{ width: "auto" }} onClick={() => setShowFriendsPanel(false)}>
                      Stäng
                    </Button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                    {!user && (
                      <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                        Logga in för att hantera vänner.
                      </div>
                    )}
                    {user && (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "rgba(255,255,255,.02)",
                          }}
                        >
                          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Sök spelare</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                            <Input
                              placeholder="Sök namn"
                              value={friendSearch}
                              onChange={(e) => setFriendSearch(e.target.value)}
                            />
                            <Button
                              variant="ghost"
                              onClick={searchProfiles}
                              style={{ width: "auto", padding: "8px 10px" }}
                            >
                              Sök
                            </Button>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            {friendResults.length === 0 && (
                              <div style={{ color: "var(--muted)" }}>Inga sökresultat.</div>
                            )}
                            {friendResults.map((p) => (
                              <div
                                key={p.id}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr auto",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: 8,
                                  borderRadius: 10,
                                  border: "1px solid var(--border)",
                                  background: "rgba(255,255,255,.02)",
                                }}
                              >
                                <div style={{ fontWeight: 700 }}>{p.display_name}</div>
                                <Button
                                  variant="ghost"
                                  onClick={() => sendFriendRequest(p.id)}
                                  style={{ width: "auto", padding: "6px 10px" }}
                                >
                                  Skicka
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "rgba(255,255,255,.02)",
                          }}
                        >
                          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Förfrågningar</div>
                          {friendRequests.incoming.length === 0 && (
                            <div style={{ color: "var(--muted)" }}>Inga inkommande förfrågningar.</div>
                          )}
                          {friendRequests.incoming.map((req) => (
                            <div
                              key={req.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                gap: 10,
                                padding: 8,
                                borderRadius: 10,
                                border: "1px solid var(--border)",
                                background: "rgba(255,255,255,.02)",
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{req.requester?.display_name ?? "Spelare"}</div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <Button
                                  onClick={() => acceptFriendRequest(req.id, req.requester?.id)}
                                  style={{ width: "auto", padding: "6px 10px" }}
                                >
                                  Acceptera
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => declineFriendRequest(req.id)}
                                  style={{ width: "auto", padding: "6px 10px" }}
                                >
                                  Neka
                                </Button>
                              </div>
                            </div>
                          ))}
                          {friendRequests.outgoing.length > 0 && (
                            <div style={{ color: "var(--muted)" }}>
                              Skickade:{" "}
                              {friendRequests.outgoing
                                .map((r) => r.addressee?.display_name ?? "Spelare")
                                .join(", ")}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "rgba(255,255,255,.02)",
                          }}
                        >
                          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Dina vänner</div>
                          {friends.length === 0 && <div style={{ color: "var(--muted)" }}>Inga vänner ännu.</div>}
                          {friends.map((f) => {
                            const stats = friendStats[f.id];
                            return (
                              <div
                                key={f.id}
                                style={{
                                  display: "grid",
                                  gap: 8,
                                  padding: 8,
                                  borderRadius: 10,
                                  border: "1px solid var(--border)",
                                  background: "rgba(255,255,255,.02)",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <div style={{ fontWeight: 700 }}>{f.display_name}</div>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <Button
                                      variant="ghost"
                                      onClick={() => loadFriendStatsFor(f.id)}
                                      style={{ width: "auto", padding: "6px 10px" }}
                                    >
                                      Visa statistik
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      onClick={() => removeFriend(f.id)}
                                      style={{ width: "auto", padding: "6px 10px" }}
                                    >
                                      Ta bort
                                    </Button>
                                  </div>
                                </div>
                                {stats && (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <div>
                                      <div style={{ fontWeight: 900 }}>{stats.wins}</div>
                                      <div style={{ color: "var(--muted)", fontWeight: 700 }}>vinster</div>
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 900 }}>
                                        {stats.winRatio != null ? stats.winRatio.toFixed(2) : "—"}
                                      </div>
                                      <div style={{ color: "var(--muted)", fontWeight: 700 }}>vinster / match</div>
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 900 }}>
                                        {stats.avgRoundsToWin ? stats.avgRoundsToWin.toFixed(1) : "—"}
                                      </div>
                                      <div style={{ color: "var(--muted)", fontWeight: 700 }}>rundor per vinst</div>
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 900 }}>{stats.kingCount}</div>
                                      <div style={{ color: "var(--muted)", fontWeight: 700 }}>king‑titlar</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "rgba(255,255,255,.02)",
                          }}
                        >
                          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Inbjudningar till rum</div>
                          {roomInvites.length === 0 && (
                            <div style={{ color: "var(--muted)" }}>Inga inbjudningar just nu.</div>
                          )}
                          {roomInvites.map((inv) => (
                            <div
                              key={inv.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                gap: 10,
                                padding: 8,
                                borderRadius: 10,
                                border: "1px solid var(--border)",
                                background: "rgba(255,255,255,.02)",
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>
                                {inv.sender?.display_name ?? "Spelare"} – {inv.roomCode || "—"}
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <Button
                                  onClick={() => acceptRoomInvite(inv)}
                                  style={{ width: "auto", padding: "6px 10px" }}
                                >
                                  Gå med
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => declineRoomInvite(inv.id)}
                                  style={{ width: "auto", padding: "6px 10px" }}
                                >
                                  Neka
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {showBlitzInfo && (
            <div
              onClick={() => setShowBlitzInfo(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.68)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 60,
              }}
            >
              <div onClick={(e) => e.stopPropagation()} style={{ width: "min(720px, 100%)" }}>
                <Card
                  style={{
                    padding: 18,
                    maxHeight: "82vh",
                    overflow: "auto",
                    background: "rgba(8,12,20,.98)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <h3 style={{ margin: 0 }}>Blitz – spelregler</h3>
                    <Button variant="ghost" style={{ width: "auto" }} onClick={() => setShowBlitzInfo(false)}>
                      Stäng
                    </Button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 12, color: "var(--text)" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800 }}>Tider</div>
                      <div style={{ color: "var(--muted)" }}>
                        Anmälan öppnar 19:45. Eventet startar exakt 20:00 (svensk tid).
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800 }}>Eliminering</div>
                      <div style={{ color: "var(--muted)" }}>
                        Var 5:e minut startar en elimineringsrunda. Alla aktiva får spela klart så att alla har lika
                        många rundor innan eliminering sker.
                      </div>
                      <div style={{ color: "var(--muted)" }}>
                        Undantag: om färre än 5 spelare är med vid start sker första elimineringen efter 10 minuter.
                      </div>
                      <div style={{ color: "var(--muted)" }}>
                        Är det fler än 10 aktiva spelare elimineras 2 spelare, annars 1. Vid lika läge på gränsen
                        elimineras alla med samma resultat (namn används inte som tie-break).
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800 }}>Tärningar</div>
                      <div style={{ color: "var(--muted)" }}>
                        Tärningar är alltid på i Blitz. Man kan inte spela utan tärningar i detta läge.
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800 }}>Poäng</div>
                      <div style={{ color: "var(--muted)" }}>1:a plats: 10 poäng • 2:a plats: 5 poäng • 3:e plats: 3 poäng.</div>
                      <div style={{ color: "var(--muted)" }}>
                        Om två spelare delar en placering delar de på poängen för de berörda placeringarna.
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800 }}>Krav</div>
                      <div style={{ color: "var(--muted)" }}>Endast inloggade spelare kan delta.</div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {showInstallHelp && !isStandalone && installPrompt && (
            <div
              onClick={() => setShowInstallHelp(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.68)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 70,
              }}
            >
              <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)" }}>
                <Card style={{ padding: 18, background: "rgba(8,12,20,.985)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <h3 style={{ margin: 0 }}>Lägg till som app</h3>
                    <Button variant="ghost" style={{ width: "auto" }} onClick={() => setShowInstallHelp(false)}>
                      Stäng
                    </Button>
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 10, color: "var(--text)" }}>
                    {installPrompt ? (
                      <>
                        <div>Klicka på knappen nedan för att installera appen på hemskärmen.</div>
                        <Button
                          onClick={installAsApp}
                        >
                          Installera
                        </Button>
                      </>
                    ) : (
                      <>
                        <div>
                          iPhone/iPad (Safari): Tryck på <strong>Dela</strong> och välj{" "}
                          <strong>Lägg till på hemskärmen</strong>.
                        </div>
                        <div>
                          Android/Chrome: Tryck på <strong>meny</strong> (⋮) och välj{" "}
                          <strong>Installera app</strong> eller <strong>Lägg till på hemskärmen</strong>.
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          <p style={{ marginTop: 14, color: "var(--muted)" }}>
            Skapa rum → dela koden → alla kan använda samma lobby.
          </p>
          <p style={{ marginTop: 8, color: "var(--muted)" }}>
            Poängblad → spela utan multiplayer.
          </p>
          </Card>
        </Container>
      </>
    );
  }

  return (
    <>
      <HarpanThemeBackground active={showHarpanThemeVideo} />
      <Container>
      <Card style={{ padding: 22 }}>
        {!isSolo && !gameStarted && !isBlitzRoom && (
          <Button
            onClick={startGame}
            disabled={startGameBusy}
            style={{
              width: "100%",
              paddingInline: 10,
              fontSize: 15,
              marginBottom: 12,
              background:
                "linear-gradient(135deg, rgba(34,197,94,.95), rgba(16,185,129,.92))",
              color: "#0b1220",
              fontWeight: 900,
              boxShadow: "0 12px 26px rgba(34,197,94,.32), 0 0 0 1px rgba(255,255,255,.12)",
            }}
          >
            {startGameBusy ? "Startar..." : "Starta spelet"}
          </Button>
        )}
        {startGameError && !isSolo && !gameStarted && !isBlitzRoom && (
          <div style={{ marginBottom: 8, color: "salmon", fontWeight: 700 }}>{startGameError}</div>
        )}
        {isSolo ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "nowrap",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button
                variant="ghost"
                style={{ width: "auto", paddingInline: 10, fontSize: 14 }}
                onClick={() => setStep("home")}
              >
                Tillbaka
              </Button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button
                variant="ghost"
                style={{ width: "auto", paddingInline: 10, fontSize: 14 }}
                onClick={() => setShowSettings(true)}
              >
                Inställningar
              </Button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Button
              variant="ghost"
              style={{ width: "100%", paddingInline: 10, fontSize: 14 }}
              onClick={() => {
                setInspectPlayerId(activePlayer?.id ?? players[0]?.id ?? null);
                setShowInspect(true);
              }}
            >
              Inspektera
            </Button>
            <Button
              variant="ghost"
              style={{ width: "100%", paddingInline: 10, fontSize: 14 }}
              onClick={() => setShowSettings(true)}
            >
              Inställningar
            </Button>
            <Button variant="danger" style={{ width: "100%", paddingInline: 10, fontSize: 14 }} onClick={handleLeave}>
              Lämna
            </Button>
          </div>
        )}


        {/* Avklarat / klara rader / ikryssade */}
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,.02)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
              alignItems: "end",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{weightedPercent}%</div>
              <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>avklarat</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{completedRows}</div>
              <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>klara rader</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{completedBoxes}</div>
              <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>ikryssade rutor</div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 10, background: "rgba(148,163,184,.22)", borderRadius: 999 }}>
              <div
                style={{
                  height: 10,
                  width: `${weightedPercent}%`,
                  background: "var(--accent)",
                  borderRadius: 999,
                  transition: "width .2s ease",
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <ScoreSheet
            progress={progress}
            onToggle={toggleCell}
            onReset={resetProgress}
            showWin={showWin}
            onCloseWin={() => setShowWin(false)}
            winVideoSrc={
              settings.themeKey === "Otis"
                ? "/otis-win.mp4"
                : settings.themeKey === "Ghost"
                  ? "/ghost-win.mp4"
                  : null
            }
            headerRight={null}
            settings={settings}
            showHeader={false}
            showReset={false}
          />
        </div>

        <DiceTray
          show={Boolean(settings.showDice)}
          canAct={canAct}
          turnTimeLeft={turnTimeLeft}
          dice={dice}
          locked={locked}
          previewLocked={previewLocked}
          isPreview={diceStatus === "choose" && !targetLocked}
          availableTargets={availableTargets}
          fullRows={fullRows}
          rolling={rolling}
          rollNonce={rollNonce}
          diceHitFlash={diceHitFlash}
          target={target}
          diceStyle={settings.diceStyle}
          onSetTarget={setTargetSafe}
          onRoll={rollOnce}
          onReroll={rerollAll}
          onEndRound={endRound}
          onInspect={() => {
            setInspectPlayerId(activePlayer?.id ?? players[0]?.id ?? null);
            setShowInspect(true);
          }}
          showInspect={!isSolo}
          lastGain={lastGain}
          status={diceStatus}
          mustCommitSelection={mustCommitSelection}
        />

        {!isSolo && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              onClick={() => setShowChat(true)}
              style={{ width: "auto", padding: "8px 10px", fontSize: 13 }}
            >
              Chat
              {chatUnread > 0 ? ` (${chatUnread})` : ""}
            </Button>
          </div>
        )}

        {!isSolo && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 800 }}>Ställning</div>
              {isBlitzRoom && blitzRunning && (
                <div
                  style={{
                    fontSize: 12,
                    color: blitzEliminationRound ? "#f87171" : "var(--muted)",
                    fontWeight: blitzEliminationRound ? 900 : 700,
                  }}
                >
                  {blitzEliminationRound ? "ELIMINERINGSRUNDA!!" : `Nästa eliminering om ${blitzElimIn ?? "—"}`}
                </div>
              )}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {playerSummaries.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: blitzRiskIds.has(p.id)
                      ? "1px solid rgba(239,68,68,.6)"
                      : "1px solid var(--border)",
                    background: blitzRiskIds.has(p.id)
                      ? "rgba(239,68,68,.12)"
                      : p.id === playerId
                      ? "rgba(255,255,255,.03)"
                      : "transparent",
                  }}
                >
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStandingPlayerId((v) => (v === p.id ? null : p.id))
                      }
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                        textAlign: "left",
                      }}
                    >
                      {p.name}
                      {p.id === playerId ? " (du)" : ""}
                    </button>
                    {selectedStandingPlayerId === p.id &&
                      user?.id &&
                      p.profileId &&
                      p.profileId !== user.id && (
                        <Button
                          variant="ghost"
                          onClick={() => sendFriendRequest(p.profileId)}
                          disabled={friendIds.has(p.profileId) || outgoingRequestIds.has(p.profileId)}
                          style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}
                        >
                          {friendIds.has(p.profileId)
                            ? "Vänner"
                            : outgoingRequestIds.has(p.profileId)
                            ? "Skickad"
                            : "Lägg till"}
                        </Button>
                      )}
                  </div>
                  <div style={{ fontWeight: 900 }}>{p.percent}%</div>
                </div>
              ))}
              {playerSummaries.length === 0 && (
                <div style={{ color: "var(--muted)" }}>Inga spelare ännu.</div>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {!isSolo && (
            <div style={{ color: "var(--muted)", fontWeight: 700 }}>
              Rumskod: <b>{roomCode.toUpperCase()}</b>
            </div>
          )}
          {isSolo && <div style={{ color: "var(--muted)", fontWeight: 700 }}>Lokalt poängblad</div>}
          <Button variant="ghost" onClick={confirmReset}>
            Återställ spel
          </Button>
        </div>
        <MiniSolitaire closeSignal={miniSolitaireCloseSignal} />
      </Card>

      {showSummary && (
        <div
          onClick={closeSummary}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.68)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 80,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(720px, 100%)" }}>
            <Card style={{ padding: 18, maxHeight: "82vh", overflow: "auto", background: "rgba(8,12,20,.985)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0 }}>{summaryTitle}</h3>
                <Button variant="ghost" style={{ width: "auto" }} onClick={closeSummary}>
                  Stäng
                </Button>
              </div>

              {showBlitzSummary && blitzEvent?.award_points === false && (
                <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 700 }}>
                  Testläge – inga poäng delas ut.
                </div>
              )}

              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {summaryRows.length === 0 && (
                  <div style={{ color: "var(--muted)" }}>Inga resultat ännu.</div>
                )}
                {summaryRows.map((row) => {
                  const points = showBlitzSummary
                    ? blitzPointsByProfile.get(row.profileId ?? row.id) ?? 0
                    : row.profileId
                    ? matchPointsByProfile.get(row.profileId) ?? 0
                    : matchPointsByName.get(row.name) ?? 0;
                  return (
                    <div
                      key={`${row.id}-${row.rank}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: row.rank === 1 ? "rgba(234,179,8,.14)" : "rgba(255,255,255,.02)",
                      }}
                    >
                      <div style={{ fontWeight: 900, minWidth: 28 }}>#{row.rank}</div>
                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={{ fontWeight: 800 }}>{row.name}</div>
                        <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                          Viktad: {row.percent}%
                        </div>
                      </div>
                      <div style={{ fontWeight: 900 }}>{Math.ceil(Number(points) || 0)}</div>
                    </div>
                  );
                })}
              </div>

              {!showBlitzSummary && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,.02)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 800 }}>Spela igen</div>
                    <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                      {rematchVoteCount}/{activeTurnOrder.length} röster
                    </div>
                  </div>
                  <Button
                    onClick={voteRematch}
                    disabled={!rematchSupportedRef.current || hasVotedRematch || activeTurnOrder.length === 0}
                  >
                    {hasVotedRematch ? "Skickat" : "Spela igen"}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.68)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)" }}>
            <Card
              style={{
                padding: 20,
                maxHeight: "82vh",
                overflow: "auto",
                background: "linear-gradient(180deg, rgba(8,12,20,.99), rgba(10,16,30,.985))",
                border: "1px solid rgba(148,163,184,.35)",
                boxShadow: "0 22px 56px rgba(2,6,23,.52)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>Inställningar</h3>
                <Button variant="ghost" onClick={() => setShowSettings(false)}>
                  Stäng
                </Button>
              </div>

              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                <div style={settingsSectionStyle}>
                  <div style={settingsSectionTitleStyle}>Storlek</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <Button
                      variant={settings.boxSize === "small" ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, boxSize: "small" }))}
                    >
                      Small
                    </Button>
                    <Button
                      variant={settings.boxSize === "medium" ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, boxSize: "medium" }))}
                    >
                      Medium
                    </Button>
                    <Button
                      variant={settings.boxSize === "large" ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, boxSize: "large" }))}
                    >
                      Large
                    </Button>
                  </div>
                </div>

                <div style={settingsSectionStyle}>
                  <div style={settingsSectionTitleStyle}>Tema</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <Button
                      variant={themeCategory === "standard" ? "primary" : "ghost"}
                      onClick={() => setThemeCategory("standard")}
                      style={{ padding: "8px 12px" }}
                    >
                      Standard ({standardThemes.length})
                    </Button>
                    <Button
                      variant={themeCategory === "special" ? "primary" : "ghost"}
                      onClick={() => setThemeCategory("special")}
                      style={{ padding: "8px 12px" }}
                    >
                      Specials ({specialThemes.length})
                    </Button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {visibleThemes.map((t) => {
                      const locked = isThemeLocked(t);
                      const lockReason = getThemeLockReason(t);
                      return (
                        <Button
                          key={t.name}
                          variant={settings.themeKey === (t.key ?? t.name) ? "primary" : "ghost"}
                          onClick={() => applyTheme(t)}
                          disabled={locked}
                          title={locked ? lockReason : t.name}
                          style={{ display: "grid", gap: 8, justifyItems: "center" }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: 46,
                              borderRadius: 10,
                              border: "1px solid rgba(148,163,184,.25)",
                              backgroundImage: [
                                `radial-gradient(120px 60px at 15% 20%, color-mix(in srgb, ${t.bgGlow1} 28%, transparent), transparent 70%)`,
                                `radial-gradient(120px 60px at 85% 10%, color-mix(in srgb, ${t.bgGlow2} 24%, transparent), transparent 70%)`,
                                `linear-gradient(180deg, #0a0f1b, ${t.bgColor})`,
                                (BG_PATTERNS[t.bgPattern ?? "none"] ?? BG_PATTERNS.none).image,
                              ].join(", "),
                              backgroundSize: [
                                "100% 100%",
                                "100% 100%",
                                "100% 100%",
                                `${(BG_PATTERNS[t.bgPattern ?? "none"] ?? BG_PATTERNS.none).size} ${(BG_PATTERNS[t.bgPattern ?? "none"] ?? BG_PATTERNS.none).size}`,
                              ].join(", "),
                              backgroundBlendMode: "screen, screen, normal, screen",
                              opacity: locked ? 0.6 : 0.9,
                            }}
                          />
                          <div style={{ fontWeight: 800, fontSize: 12 }}>
                            {t.name}
                            {locked ? " 🔒" : ""}
                          </div>
                          {locked && (
                            <div style={{ fontWeight: 700, fontSize: 10, color: "var(--muted)", lineHeight: 1.2 }}>
                              {lockReason}
                            </div>
                          )}
                        </Button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedColors((v) => !v)}
                    style={settingsLinkButtonStyle}
                  >
                    {showAdvancedColors ? "Dölj avancerat" : "Visa avancerat"}
                  </button>

                  {showAdvancedColors && (
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Button
                          variant={advancedTab === "colors" ? "primary" : "ghost"}
                          onClick={() => setAdvancedTab("colors")}
                          style={{ width: "auto", padding: "8px 12px" }}
                        >
                          Färger
                        </Button>
                        <Button
                          variant={advancedTab === "personal" ? "primary" : "ghost"}
                          onClick={() => setAdvancedTab("personal")}
                          style={{ width: "auto", padding: "8px 12px" }}
                        >
                          Personliga färgteman
                        </Button>
                      </div>

                      {advancedTab === "colors" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "var(--muted)" }}>
                            Bakgrund
                            <input
                              type="color"
                              value={settings.bgColor ?? "#0b1020"}
                              onChange={(e) => setSettings((s) => ({ ...s, bgColor: e.target.value }))}
                              style={{
                                width: "100%",
                                height: 36,
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                background: "transparent",
                              }}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "var(--muted)" }}>
                            Bakgrund (glow 1)
                            <input
                              type="color"
                              value={settings.bgGlow1 ?? "#38bdf8"}
                              onChange={(e) => setSettings((s) => ({ ...s, bgGlow1: e.target.value }))}
                              style={{
                                width: "100%",
                                height: 36,
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                background: "transparent",
                              }}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "var(--muted)" }}>
                            Knappar
                            <input
                              type="color"
                              value={settings.accentColor ?? "#22c55e"}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  accentColor: e.target.value,
                                  checkColor: e.target.value,
                                }))
                              }
                              style={{
                                width: "100%",
                                height: 36,
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                background: "transparent",
                              }}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "var(--muted)" }}>
                            Bakgrund (glow 2)
                            <input
                              type="color"
                              value={settings.bgGlow2 ?? "#22c55e"}
                              onChange={(e) => setSettings((s) => ({ ...s, bgGlow2: e.target.value }))}
                              style={{
                                width: "100%",
                                height: 36,
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                background: "transparent",
                              }}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "var(--muted)" }}>
                        Färdig rad
                        <input
                          type="color"
                          value={settings.rowCompleteBg ?? "#1f3b2e"}
                          onChange={(e) => setSettings((s) => ({ ...s, rowCompleteBg: e.target.value }))}
                          style={{
                            width: "100%",
                            height: 36,
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            background: "transparent",
                          }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "var(--muted)" }}>
                        Ringar (ifyllda)
                        <input
                          type="color"
                          value={settings.filledRingColor ?? settings.checkColor ?? "#22c55e"}
                          onChange={(e) => setSettings((s) => ({ ...s, filledRingColor: e.target.value }))}
                          style={{
                            width: "100%",
                            height: 36,
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            background: "transparent",
                          }}
                        />
                      </label>
                          <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "var(--muted)" }}>
                            Mönster
                            <select
                              value={settings.bgPattern ?? "none"}
                              onChange={(e) => setSettings((s) => ({ ...s, bgPattern: e.target.value }))}
                              style={{
                                width: "100%",
                                height: 36,
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                background: "transparent",
                                color: "var(--text)",
                              }}
                            >
                              <option value="none">Ingen</option>
                          <option value="moon">Midnight – Måne</option>
                          <option value="waves">Ocean – Vågor</option>
                          <option value="forest">Forest – Skog</option>
                          <option value="embers">Amber – Glöd</option>
                          <option value="petals">Rose – Kronblad</option>
                          <option value="blossom-trees">Cherry Blossom – Träd</option>
                          <option value="stars">Stars – Stjärnor</option>
                          <option value="snow">Ice – Snöflingor</option>
                          <option value="paws">Otis – Tassar</option>
                          <option value="crystals">Ice – Kristaller</option>
                          <option value="reggae">Reggae – Ränder</option>
                          <option value="galaxy">Galax – Vintergatan</option>
                          <option value="ghost-mist">Ghost – Dimma</option>
                          <option value="royal" disabled={kingLocked}>
                            King – Kronor
                          </option>
                          <option value="lava">Lava – Sprickor</option>
                        </select>
                          </label>
                          <label style={{ display: "grid", gap: 6, fontWeight: 700, color: "var(--muted)" }}>
                            Mönsterstyrka
                            <input
                              type="range"
                              min="0"
                              max="0.6"
                              step="0.05"
                              value={settings.bgPatternOpacity ?? 0.25}
                              onChange={(e) =>
                                setSettings((s) => ({ ...s, bgPatternOpacity: Number(e.target.value) }))
                              }
                              style={{ width: "100%" }}
                            />
                          </label>
                        </div>
                      )}

                      {advancedTab === "personal" && (
                        <div style={{ display: "grid", gap: 10 }}>
                          {!user && (
                            <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                              Logga in för att spara personliga färgteman.
                            </div>
                          )}
                          {user && (
                            <>
                              <div style={{ display: "grid", gap: 8 }}>
                                <div style={{ fontWeight: 800 }}>Spara nuvarande färger</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                                  <Input
                                    placeholder="Namn på tema"
                                    value={personalThemeName}
                                    onChange={(e) => setPersonalThemeName(e.target.value)}
                                  />
                                  <Button
                                    variant="ghost"
                                    onClick={savePersonalTheme}
                                    disabled={!personalThemeName.trim()}
                                    style={{ width: "auto" }}
                                  >
                                    Spara
                                  </Button>
                                </div>
                              </div>

                              <div style={{ display: "grid", gap: 8 }}>
                                {(settings.personalThemes ?? []).length === 0 && (
                                  <div style={{ color: "var(--muted)" }}>Inga sparade teman ännu.</div>
                                )}
                                {(settings.personalThemes ?? []).map((t) => (
                                  <div
                                    key={t.id}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr auto",
                                      alignItems: "center",
                                      gap: 10,
                                      padding: 10,
                                      borderRadius: 12,
                                      border: "1px solid var(--border)",
                                      background: "rgba(255,255,255,.02)",
                                    }}
                                  >
                                    <div style={{ display: "grid", gap: 6 }}>
                                      <div style={{ fontWeight: 800 }}>{t.name}</div>
                                      <div style={{ display: "flex", gap: 6 }}>
                                        {[t.colors.bgColor, t.colors.bgGlow1, t.colors.bgGlow2, t.colors.accentColor].map(
                                          (c, i) => (
                                            <span
                                              key={`${t.id}-${i}`}
                                              style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: 999,
                                                border: "1px solid rgba(255,255,255,.2)",
                                                background: c,
                                                display: "inline-block",
                                              }}
                                            />
                                          )
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <Button
                                        variant={settings.personalThemeId === t.id ? "primary" : "ghost"}
                                        onClick={() => applyPersonalTheme(t)}
                                        style={{ width: "auto", padding: "8px 10px" }}
                                      >
                                        Använd
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        onClick={() => deletePersonalTheme(t.id)}
                                        style={{ width: "auto", padding: "8px 10px" }}
                                      >
                                        Ta bort
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isSolo && (
                  <div style={settingsSectionStyle}>
                    <div style={settingsSectionTitleStyle}>Lobby</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <div style={{ color: "var(--muted)", fontWeight: 700 }}>Rumskod</div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>{roomCode.toUpperCase()}</div>
                      </div>
                      <Button variant="danger" onClick={handleLeave}>
                        Lämna lobby
                      </Button>
                    </div>
                  </div>
                )}

                {!isSolo && (
                  <div style={settingsSectionStyle}>
                    <div style={settingsSectionTitleStyle}>
                      Bjud in vänner
                    </div>
                    {!user && (
                      <div style={{ color: "var(--muted)" }}>Logga in för att bjuda in vänner.</div>
                    )}
                    {user && (
                      <div style={{ display: "grid", gap: 10 }}>
                        <Button variant="ghost" onClick={shareRoomLink}>
                          Dela via SMS / länk
                        </Button>
                        {friends.length === 0 && (
                          <div style={{ color: "var(--muted)" }}>Inga vänner att bjuda in ännu.</div>
                        )}
                        {friends.map((f) => {
                          const sent = Boolean(sentInvites?.[f.id]);
                          return (
                            <div
                              key={f.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                gap: 10,
                                padding: 8,
                                borderRadius: 10,
                                border: "1px solid var(--border)",
                                background: "rgba(255,255,255,.02)",
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{f.display_name}</div>
                              <Button
                                variant={sent ? "primary" : "ghost"}
                                disabled={sent}
                                onClick={() => sendRoomInvite(f.id)}
                                style={{
                                  width: "auto",
                                  padding: "6px 10px",
                                  transform: sent ? "translateY(1px)" : "none",
                                  boxShadow: sent
                                    ? "inset 0 2px 6px rgba(15,23,42,.45), 0 0 0 1px rgba(255,255,255,.16)"
                                    : undefined,
                                  opacity: sent ? 0.95 : 1,
                                }}
                              >
                                {sent ? "Skickat" : "Bjud in"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div style={settingsSectionStyle}>
                  <div style={settingsSectionTitleStyle}>Tärningar</div>
                  <div style={settingsInlineRowStyle}>
                    <Button
                      variant={settings.showDice ? "primary" : "ghost"}
                      onClick={() => {
                        if (isBlitzRoom) return;
                        setSettings((s) => ({ ...s, showDice: !s.showDice }));
                      }}
                      disabled={isBlitzRoom}
                    >
                      {isBlitzRoom ? "På (Blitz)" : settings.showDice ? "På" : "Av"}
                    </Button>
                  </div>
                  {settings.showDice && (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <div style={settingsInlineRowStyle}>
                        <div style={{ fontWeight: 700 }}>Ljud vid slag</div>
                        <Button
                          variant={settings.diceSound ? "primary" : "ghost"}
                          onClick={() => setSettings((s) => ({ ...s, diceSound: !s.diceSound }))}
                          style={{ width: "auto", padding: "8px 10px" }}
                        >
                          {settings.diceSound ? "På" : "Av"}
                        </Button>
                      </div>
                      <div style={settingsInlineRowStyle}>
                        <div style={{ fontWeight: 700 }}>Vibration vid slag</div>
                        <Button
                          variant={settings.diceHaptics ? "primary" : "ghost"}
                          onClick={() => setSettings((s) => ({ ...s, diceHaptics: !s.diceHaptics }))}
                          style={{ width: "auto", padding: "8px 10px" }}
                        >
                          {settings.diceHaptics ? "På" : "Av"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {settings.showDice && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => setShowDiceStyles((v) => !v)}
                        style={{ ...settingsLinkButtonStyle, marginTop: 0 }}
                      >
                        {showDiceStyles ? "Dölj tärningsdesign" : "Visa tärningsdesign"}
                      </button>
                    </div>
                  )}
                  {settings.showDice && showDiceStyles && (
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      {[
                        { key: "classic", label: "Klassisk" },
                        { key: "glass", label: "Glas" },
                        { key: "neon", label: "Neon" },
                        { key: "etched", label: "Graverad" },
                        { key: "wood", label: "Trä" },
                        { key: "king", label: "King (guld)", kingOnly: true },
                      ].map((opt) => (
                        <div
                          key={opt.key}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            gap: 10,
                            padding: 10,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "rgba(255,255,255,.02)",
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>
                            {opt.label}
                            {opt.kingOnly && kingLocked ? " 🔒" : ""}
                          </div>
                          <Button
                            variant={settings.diceStyle === opt.key ? "primary" : "ghost"}
                            onClick={() => setSettings((s) => ({ ...s, diceStyle: opt.key }))}
                            disabled={Boolean(opt.kingOnly && kingLocked)}
                            style={{ width: "auto", padding: "8px 10px" }}
                          >
                            Välj
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={settingsSectionStyle}>
                  <div style={settingsSectionTitleStyle}>Alert</div>
                  <div style={settingsInlineRowStyle}>
                    <Button
                      variant={settings.vibrateOnTurn ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, vibrateOnTurn: !s.vibrateOnTurn }))}
                    >
                      {settings.vibrateOnTurn ? "På" : "Av"}
                    </Button>
                  </div>
                </div>

                <div style={settingsSectionStyle}>
                  <div style={settingsSectionTitleStyle}>Notiser</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={settingsInlineRowStyle}>
                      <div style={{ fontWeight: 700 }}>När det är din tur</div>
                      <Button
                        variant={settings.notifyTurn ? "primary" : "ghost"}
                        onClick={toggleNotifyTurn}
                      >
                        {settings.notifyTurn ? "På" : "Av"}
                      </Button>
                    </div>
                    <div style={settingsInlineRowStyle}>
                      <div style={{ fontWeight: 700 }}>Rumsinbjudan</div>
                      <Button
                        variant={settings.notifyInvite ? "primary" : "ghost"}
                        onClick={toggleNotifyInvite}
                      >
                        {settings.notifyInvite ? "På" : "Av"}
                      </Button>
                    </div>
                    <div style={settingsInlineRowStyle}>
                      <div style={{ fontWeight: 700 }}>Event</div>
                      <Button
                        variant={settings.notifyBlitz ? "primary" : "ghost"}
                        onClick={toggleNotifyBlitz}
                      >
                        {settings.notifyBlitz ? "På" : "Av"}
                      </Button>
                    </div>
                  </div>
                  <div style={{ color: "var(--muted)", fontWeight: 600, marginTop: 6 }}>
                    Notiser fungerar när appen är öppen. Blitz-notiser kan skickas i bakgrunden.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {!isSolo && showInspect && (
        <div
          onClick={() => setShowInspect(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.68)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(860px, 100%)" }}>
            <Card style={{ padding: 18, maxHeight: "82vh", overflow: "auto", background: "rgba(8,12,20,.985)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0 }}>Inspektera</h3>
                <Button variant="ghost" style={{ width: "auto" }} onClick={() => setShowInspect(false)}>
                  Stäng
                </Button>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "var(--muted)", fontWeight: 700 }}>Följ aktiv spelare</div>
                  <Button
                    variant={followActivePlayer ? "primary" : "ghost"}
                    onClick={() => setFollowActivePlayer((v) => !v)}
                    style={{ width: "auto", padding: "8px 10px" }}
                  >
                    {followActivePlayer ? "På" : "Av"}
                  </Button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {players.map((p) => (
                    <Button
                      key={p.id}
                      variant={inspectPlayerId === p.id ? "primary" : "ghost"}
                      onClick={() => {
                        setFollowActivePlayer(false);
                        setInspectPlayerId(p.id);
                      }}
                      style={{ width: "auto", padding: "8px 10px" }}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>

                {inspectPlayerId ? (
                  (() => {
                    const ps = playerStates.find((s) => s.player_id === inspectPlayerId);
                    const prog = ps?.progress ?? (inspectPlayerId === playerId ? progress : emptyProgress());
                    const lastDice = ps?.last_dice ?? [];
                    const lastTarget = ps?.last_target;
                    const player = players.find((p) => p.id === inspectPlayerId);
                    const theme = ps?.theme_snapshot ?? null;
                    const inspectSettings = theme
                      ? { ...settings, ...theme, boxSize: "small" }
                      : { ...settings, boxSize: "small" };
                    const diceStyle = theme?.diceStyle ?? settings.diceStyle;
                    const hasDice = Array.isArray(lastDice) && lastDice.length === 6;
                    const targetLocks =
                      hasDice && lastTarget
                        ? computeLocks(lastDice, Array(6).fill(false), lastTarget).nextLocked
                        : Array(6).fill(false);
                    const diceVars = theme
                      ? {
                          "--dice-bg": theme.diceBg ?? settings.diceBg,
                          "--dice-pip": theme.dicePip ?? settings.dicePip,
                          "--dice-border": theme.diceBorder ?? settings.diceBorder,
                          "--dice-locked": theme.diceLocked ?? settings.diceLocked,
                          "--dice-pip-locked": theme.dicePipLocked ?? settings.dicePipLocked,
                        }
                      : {};
                    return (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ fontWeight: 800 }}>
                          {player?.name ?? "Spelare"}
                          {roomState?.turn_player_id === inspectPlayerId ? " (aktiv)" : ""}
                        </div>

                        {hasDice && (
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                              Tärningar {lastTarget ? `(markerar ${lastTarget})` : ""}
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                                gap: 10,
                                justifyItems: "center",
                                ...diceVars,
                              }}
                            >
                              {lastDice.map((d, i) => (
                                <DieFace
                                  key={i}
                                  value={d}
                                  locked={targetLocks[i]}
                                  isPreview={Boolean(lastTarget)}
                                  rolling={false}
                                  diceStyle={diceStyle}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {!hasDice && <div style={{ color: "var(--muted)" }}>Inga tärningar ännu.</div>}

                        <ScoreSheet
                          progress={prog}
                          onToggle={() => {}}
                          onReset={() => {}}
                          showWin={false}
                          onCloseWin={() => {}}
                          headerRight={null}
                          settings={inspectSettings}
                          readOnly
                          showReset={false}
                          showHeader={false}
                        />
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ color: "var(--muted)" }}>Inga spelare.</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {chatToasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: 76,
            left: "50%",
            transform: "translateX(-50%)",
            display: "grid",
            gap: 8,
            zIndex: 90,
            maxWidth: "92vw",
            width: "min(520px, 92vw)",
            pointerEvents: "none",
          }}
        >
          {chatToasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                background: "rgba(15,23,42,.92)",
                color: "white",
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.14)",
                fontWeight: 700,
                boxShadow: "0 12px 30px rgba(2,6,23,.4)",
              }}
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}

      {showChat && (
        <div
          onClick={() => setShowChat(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.68)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 70,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(860px, 100%)" }}>
            <Card style={{ padding: 18, maxHeight: "82vh", overflow: "auto", background: "rgba(8,12,20,.985)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0 }}>Chat</h3>
                <Button variant="ghost" style={{ width: "auto" }} onClick={() => setShowChat(false)}>
                  Stäng
                </Button>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div
                  style={{
                    maxHeight: "52vh",
                    overflow: "auto",
                    display: "grid",
                    gap: 8,
                    padding: 8,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,.02)",
                  }}
                >
                  {chatMessages.length === 0 && (
                    <div style={{ color: "var(--muted)" }}>Inga meddelanden ännu.</div>
                  )}
                  {chatMessages.map((m) => (
                    <div key={m.id} style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 800 }}>{m.sender_name}</div>
                      <div style={{ color: "var(--text)" }}>{m.body}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <Input
                    placeholder="Skriv ett meddelande..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendChat();
                    }}
                  />
                  <Button onClick={sendChat} style={{ width: "auto" }}>
                    Skicka
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {turnFlash && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(56,189,248,.14)",
            display: "grid",
            placeItems: "center",
            zIndex: 80,
            pointerEvents: "none",
            animation: "turnPulse 1.6s ease-in-out 1",
          }}
        >
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              letterSpacing: 1,
              color: "white",
              textShadow: "0 8px 30px rgba(0,0,0,.55)",
            }}
          >
            DIN TUR
          </div>
        </div>
      )}
      </Container>
    </>
  );
}

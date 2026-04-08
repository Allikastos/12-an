import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import CanastaLobbySetup from "./canasta/CanastaLobbySetup";
import CanastaBoardView from "./canasta/CanastaBoardView";
import CanastaHandPanel from "./canasta/CanastaHandPanel";
import CanastaMeldPlanModal from "./canasta/CanastaMeldPlanModal";
import CanastaExpandedTeamModal from "./canasta/CanastaExpandedTeamModal";
import CanastaSettingsModal from "./canasta/CanastaSettingsModal";
import { TeamMelds, CanastaFace } from "./canasta/CanastaCardViews";
import { buildMeldPreviewCards } from "../lib/canastaPresentation";
import { seatTemplateList } from "../lib/canastaLayout";
import {
  rankLabel,
  sortHandCards,
  cardLabel,
  isWild,
  cardPoints,
  openingRequirement,
  getTeamTotalFromTotals,
  getPlayerOpeningTotal,
  computeRoundResults,
  updateTotalsAfterRound,
  getMatchWinnerTeamId,
  makeGame,
  drawTwoState,
  canTakeDiscard,
  takeDiscardStackState,
  pickBotMeldCardIds,
  pickDiscardCardId,
  discardState,
  applyMeld,
  applyMeldMany,
  shouldUseMeldPlanner,
  createMeldPlan,
  resolvePlannedGroups,
  applyMeldGroups,
} from "../lib/canastaEngine";

const MOBILE_QUERY = "(max-width: 1024px), (pointer: coarse)";


export default function CanastaBoard({
  onBack,
  settings: externalSettings = null,
  setSettings: setExternalSettings = null,
  themes = [],
  applyTheme = null,
  initialPlayerName = "Spelare 1",
  onLeaderboardPointsAwarded = null,
  roomCode = "",
  friends = [],
  sentInvites = {},
  onSendRoomInvite = null,
  onShareRoom = null,
  isHost = true,
  hostName = "",
  roomPlayers = [],
  roomState = null,
  playerId = null,
  onAddBot = null,
  onRemoveBot = null,
  onUpdateLobbyConfig = null,
  onSyncMatchState = null,
}) {
  const [stage, setStage] = useState("setup");
  const [mode, setMode] = useState("single");
  const [targetScore, setTargetScore] = useState(10000);
  const [lobbyPlayers, setLobbyPlayers] = useState(() => [
    { id: "human-1", name: initialPlayerName || "Spelare 1", isBot: false },
  ]);
  const [totals, setTotals] = useState([0, 0, 0, 0, 0, 0]);
  const [game, setGame] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [handOrder, setHandOrder] = useState([]);
  const [dragCardId, setDragCardId] = useState(null);
  const [hoverCardId, setHoverCardId] = useState(null);
  const [handDropSide, setHandDropSide] = useState(null);
  const [mobileSortMode, setMobileSortMode] = useState(false);
  const [recentDrawnIds, setRecentDrawnIds] = useState([]);
  const [meldPlan, setMeldPlan] = useState(null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vibrateOnTurn, setVibrateOnTurn] = useState(true);
  const [themeCategory, setThemeCategory] = useState("standard");
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [turnFlash, setTurnFlash] = useState(false);
  const [inactiveFlash, setInactiveFlash] = useState(false);
  const [roundLeaderboardPoints, setRoundLeaderboardPoints] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [nextRoundCountdown, setNextRoundCountdown] = useState(null);
  const [transitioningToGame, setTransitioningToGame] = useState(false);
  const [lobbyStatus, setLobbyStatus] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false
  );
  const [isLandscapeViewport, setIsLandscapeViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > window.innerHeight : false
  );
  const prevTurnRef = useRef(null);
  const turnFlashTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const handAreaRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const suppressTapRef = useRef(false);
  const pointerStartRef = useRef(null);
  const pressedCardIdRef = useRef(null);
  const dragTargetRef = useRef({ side: null, targetId: null });
  const pointsAwardedRef = useRef(false);
  const roundScoreAppliedRef = useRef(false);
  const startTransitionTimerRef = useRef(null);
  const lobbyStatusTimerRef = useRef(null);
  const nextRoundTimerRef = useRef(null);
  const nextRoundIntervalRef = useRef(null);
  const previousLobbyIdsRef = useRef([]);
  const previousLobbyConfigRef = useRef({ mode: null, targetScore: null });
  const canastaMatchSyncRef = useRef("");
  const canastaMatchVersionRef = useRef(0);
  const prevHandIdsRef = useRef([]);

  const canastaStorageKey = useMemo(() => {
    if (!roomCode) return null;
    return `canasta_session_${roomCode.toUpperCase()}`;
  }, [roomCode]);

  const syncedLobbyPlayers = useMemo(() => {
    if (Array.isArray(roomPlayers) && roomPlayers.length > 0) {
      return roomPlayers.map((player, idx) => ({
        id: player.id,
        name: player.name?.trim() || `Spelare ${idx + 1}`,
        isBot: String(player.device_id ?? "").startsWith("bot:"),
      }));
    }
    return [{ id: "human-1", name: initialPlayerName || "Spelare 1", isBot: false }];
  }, [roomPlayers, initialPlayerName]);

  const roomRoundCounts = roomState?.round_counts ?? {};
  const sharedLobbyMode = roomRoundCounts?.__canasta_mode;
  const sharedTargetScore = Number(roomRoundCounts?.__canasta_target_score);
  const sharedCanastaMatch = roomRoundCounts?.__canasta_match ?? null;

  const activePlayer = game ? game.players[game.turnIndex] : null;
  const seatPlayers = useMemo(() => {
    if (Array.isArray(syncedLobbyPlayers) && syncedLobbyPlayers.length > 0) {
      return syncedLobbyPlayers;
    }
    if (game?.players?.length) {
      return game.players.map((player, idx) => ({
        id: player.id ?? `seat-${idx}`,
        name: player.name,
        isBot: Boolean(player.isBot),
      }));
    }
    return [];
  }, [syncedLobbyPlayers, game]);
  const localPlayerIndex = useMemo(() => {
    if (!game?.players?.length) return 0;
    if (playerId && seatPlayers.length > 0) {
      const roomIndex = seatPlayers.findIndex((p) => p.id === playerId);
      if (roomIndex >= 0 && roomIndex < game.players.length) return roomIndex;
    }
    const firstHuman = game.players.findIndex((p) => !p.isBot);
    return firstHuman >= 0 ? firstHuman : 0;
  }, [game, playerId, seatPlayers]);
  const myPlayer = game ? game.players[localPlayerIndex] : null;
  const topDiscard = game?.discard?.[game.discard.length - 1] ?? null;
  const isBotTurn = Boolean(activePlayer?.isBot);
  const activeSeatPlayerId = game && seatPlayers[game.turnIndex] ? seatPlayers[game.turnIndex].id : null;
  const localSeatPlayerId = seatPlayers[localPlayerIndex]?.id ?? null;
  const canAuthorMatchUpdate = Boolean(
    game &&
      (game.roundEnded
        ? isHost
        : (isBotTurn && isHost) ||
          (!isBotTurn && playerId && activeSeatPlayerId && String(activeSeatPlayerId) === String(playerId)) ||
          (!isBotTurn && !playerId && game.turnIndex === localPlayerIndex))
  );
  const isMyTurn = Boolean(
    game &&
      !game.roundEnded &&
      !isBotTurn &&
      ((playerId && activeSeatPlayerId && String(activeSeatPlayerId) === String(playerId)) ||
        (!playerId && game.turnIndex === localPlayerIndex) ||
        (!activeSeatPlayerId && localSeatPlayerId && game.turnIndex === localPlayerIndex))
  );
  const canSortHand = !game?.roundEnded;
  const handReorderEnabled = canSortHand && (!isMobile || mobileSortMode);
  const isMobileLandscape = isMobile && isLandscapeViewport;
  const standardThemes = useMemo(
    () => themes.filter((theme) => (theme.category ?? "standard") === "standard"),
    [themes]
  );
  const specialThemes = useMemo(
    () => themes.filter((theme) => (theme.category ?? "standard") === "special"),
    [themes]
  );
  const visibleThemes = themeCategory === "special" ? specialThemes : standardThemes;

  const teamTotals = useMemo(() => {
    if (!game) return {};
    const byTeam = Object.fromEntries(
      [...new Set(game.players.map((player) => player.teamId))].map((teamId) => [
        teamId,
        getTeamTotalFromTotals(game, totals, teamId),
      ])
    );
    return byTeam;
  }, [game, totals]);

  const teamZones = useMemo(() => {
    if (!game) return [];
    const map = new Map();
    game.players.forEach((p, idx) => {
      const team = map.get(p.teamId) ?? { teamId: p.teamId, playerNames: [], anchorIndex: idx };
      team.playerNames.push(p.name);
      if (idx < team.anchorIndex) team.anchorIndex = idx;
      map.set(p.teamId, team);
    });
    let order = 1;
    return [...map.values()].map((team) => {
      const teamState = game.teams[team.teamId];
      const teamPlayers = game.players.filter((p) => p.teamId === team.teamId);
      const label =
        game.mode === "single"
          ? team.playerNames[0]
          : `Lag ${order++}`;
      return {
        teamId: team.teamId,
        label,
        opened: Boolean(teamState?.opened),
        melds: teamState?.melds ?? [],
        anchorIndex: team.anchorIndex,
        redThreeCount: teamPlayers.reduce((acc, p) => acc + (p.redThrees?.length ?? 0), 0),
      };
    });
  }, [game]);
  const visibleTeamZones = teamZones;
  const openingByPlayer = useMemo(() => {
    if (!game) return [];
    return game.players.map((_, i) => openingRequirement(getPlayerOpeningTotal(game, totals, i)));
  }, [game, totals]);
  const seatTemplates = useMemo(
    () => seatTemplateList(game?.players?.length ?? 0, isMobile),
    [game?.players?.length, isMobile]
  );

  const orderedHand = useMemo(() => {
    if (!myPlayer) return [];
    const byId = new Map(myPlayer.hand.map((c) => [c.id, c]));
    const ordered = handOrder.map((id) => byId.get(id)).filter(Boolean);
    for (const c of myPlayer.hand) {
      if (!ordered.some((x) => x.id === c.id)) ordered.push(c);
    }
    return ordered;
  }, [myPlayer, handOrder]);

  const ids = orderedHand.map((c) => c.id);
  const actualHandCount = orderedHand.length;
  const handCount = Math.max(actualHandCount, 1);
  const handCenter = (handCount - 1) / 2;
  const handCardWidth = isMobile
    ? actualHandCount >= 18
      ? 44
      : actualHandCount >= 15
      ? 48
      : actualHandCount >= 12
      ? 54
      : 64
    : actualHandCount >= 18
    ? 62
    : 80;
  const handCardHeight = Math.round(handCardWidth * 1.5);
  const handAreaHeight = isMobileLandscape ? 176 : isMobile ? (actualHandCount >= 15 ? 138 : 150) : 192;
  const handSpan = isMobileLandscape ? 560 : isMobile ? 320 : 680;
  const handStep = Math.min(isMobile ? 34 : 46, handCount > 1 ? handSpan / (handCount - 1) : 0);
  const resolveHandDropTarget = useCallback((clientX) => {
    const container = handAreaRef.current;
    if (!container || !orderedHand.length) return { side: null, targetId: null };
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const dragIdx = orderedHand.findIndex((c) => c.id === dragCardId);
    const centers = orderedHand.map((_, idx) => rect.width / 2 + (idx - handCenter) * handStep);
    const sideInset = Math.max(6, Math.min(isMobile ? 10 : 16, handStep * 0.28));

    if (x <= centers[0] - sideInset) {
      return { side: "left", targetId: orderedHand[0]?.id ?? null };
    }
    if (x >= centers[centers.length - 1] + sideInset) {
      return { side: "right", targetId: orderedHand[orderedHand.length - 1]?.id ?? null };
    }

    let targetIdx = centers.length - 1;
    for (let i = 0; i < centers.length - 1; i += 1) {
      const midpoint = (centers[i] + centers[i + 1]) / 2;
      if (x < midpoint) {
        targetIdx = i;
        break;
      }
      targetIdx = i + 1;
    }

    if (dragIdx >= 0) {
      if (targetIdx === dragIdx) {
        targetIdx = x >= centers[dragIdx]
          ? Math.min(orderedHand.length - 1, dragIdx + 1)
          : Math.max(0, dragIdx - 1);
      }
    }

    let targetId = orderedHand[targetIdx]?.id ?? null;
    if (targetId === dragCardId && dragIdx >= 0) {
      const fallbackIdx = x >= centers[dragIdx]
        ? Math.min(orderedHand.length - 1, dragIdx + 1)
        : Math.max(0, dragIdx - 1);
      targetId = orderedHand[fallbackIdx]?.id ?? null;
    }
    return { side: null, targetId };
  }, [orderedHand, dragCardId, handCenter, handStep, isMobile]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("canasta_settings_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.vibrateOnTurn === "boolean") setVibrateOnTurn(parsed.vibrateOnTurn);
    } catch {
      // Ignore broken local settings.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("canasta_settings_v1", JSON.stringify({ vibrateOnTurn }));
    } catch {
      // Ignore persistence errors.
    }
  }, [vibrateOnTurn]);

  useEffect(() => {
    setLobbyPlayers(syncedLobbyPlayers);
  }, [syncedLobbyPlayers]);

  useEffect(() => {
    if (!canastaStorageKey || typeof window === "undefined") return;
    if (roomCode && typeof onSyncMatchState === "function") return;
    try {
      const raw = window.localStorage.getItem(canastaStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.stage === "game" && saved?.game) {
        setGame(saved.game);
        setTotals(Array.isArray(saved.totals) ? saved.totals : []);
        setSelectedIds([]);
        setHandOrder([]);
        setMobileSortMode(false);
        setMeldPlan(null);
        setExpandedTeamId(null);
        setStage("game");
      }
    } catch {
      // Ignore broken saved sessions.
    }
  }, [canastaStorageKey, roomCode, onSyncMatchState]);

  useEffect(() => {
    if (!canastaStorageKey || typeof window === "undefined") return;
    try {
      if (stage === "game" && game) {
        window.localStorage.setItem(
          canastaStorageKey,
          JSON.stringify({
            stage,
            mode,
            targetScore,
            totals,
            game,
            savedAt: Date.now(),
          })
        );
      } else {
        window.localStorage.removeItem(canastaStorageKey);
      }
    } catch {
      // Ignore persistence issues.
    }
  }, [canastaStorageKey, stage, mode, targetScore, totals, game]);

  useEffect(() => {
    if (sharedLobbyMode === "single" || sharedLobbyMode === "team") {
      setMode(sharedLobbyMode);
    }
  }, [sharedLobbyMode]);

  useEffect(() => {
    if (sharedTargetScore === 5000 || sharedTargetScore === 10000) {
      setTargetScore(sharedTargetScore);
    }
  }, [sharedTargetScore]);

  useEffect(() => {
    if (!sharedCanastaMatch?.game || sharedCanastaMatch?.stage !== "game") return;
    const incomingVersion = Number(sharedCanastaMatch.savedAt || 0);
    if (incomingVersion && incomingVersion < canastaMatchVersionRef.current) return;
    const serialized = JSON.stringify({
      stage: sharedCanastaMatch.stage,
      game: sharedCanastaMatch.game,
      totals: sharedCanastaMatch.totals ?? [],
    });
    if (serialized === canastaMatchSyncRef.current) return;
    if (incomingVersion) canastaMatchVersionRef.current = incomingVersion;
    canastaMatchSyncRef.current = serialized;
    const shouldAnimateStart = stage !== "game";
    if (shouldAnimateStart) {
      setTransitioningToGame(true);
      if (startTransitionTimerRef.current) clearTimeout(startTransitionTimerRef.current);
      startTransitionTimerRef.current = setTimeout(() => setTransitioningToGame(false), 950);
      if (sharedCanastaMatch.updatedBy && playerId && String(sharedCanastaMatch.updatedBy) !== String(playerId)) {
        setLobbyStatus("Värden startade matchen.");
      }
    }
    setGame(sharedCanastaMatch.game);
    setTotals(Array.isArray(sharedCanastaMatch.totals) ? sharedCanastaMatch.totals : []);
    setSelectedIds([]);
    setHandOrder([]);
    setMobileSortMode(false);
    setMeldPlan(null);
    setExpandedTeamId(null);
    setStage("game");
  }, [sharedCanastaMatch, stage, playerId]);

  useEffect(() => {
    if (stage !== "game" || !game || typeof onSyncMatchState !== "function") return;
    if (!canAuthorMatchUpdate) return;
    const nextSavedAt = Date.now();
    if (nextSavedAt < canastaMatchVersionRef.current) return;
    const payload = {
      stage: "game",
      game,
      totals,
      mode,
      targetScore,
      updatedBy: playerId ?? null,
      turnOwnerId: activeSeatPlayerId ?? null,
      savedAt: nextSavedAt,
    };
    const serialized = JSON.stringify({
      stage: payload.stage,
      game: payload.game,
      totals: payload.totals,
    });
    if (serialized === canastaMatchSyncRef.current) return;
    canastaMatchVersionRef.current = nextSavedAt;
    canastaMatchSyncRef.current = serialized;
    void onSyncMatchState(payload);
  }, [stage, game, totals, mode, targetScore, playerId, onSyncMatchState, canAuthorMatchUpdate, activeSeatPlayerId]);

  useEffect(() => {
    const previous = previousLobbyConfigRef.current;
    if (previous.mode == null && previous.targetScore == null) {
      previousLobbyConfigRef.current = { mode, targetScore };
      return;
    }

    if (!isHost && previous.mode !== mode) {
      setLobbyStatus(`Värden ändrade spelläge till ${mode === "team" ? "Lag 2v2" : "Singel"}.`);
    } else if (!isHost && previous.targetScore !== targetScore) {
      setLobbyStatus(`Värden ändrade matchmålet till ${targetScore.toLocaleString("sv-SE")} poäng.`);
    }

    previousLobbyConfigRef.current = { mode, targetScore };
  }, [mode, targetScore, isHost]);

  function start() {
    if (!isHost) return;
    const playerCount = lobbyPlayers.length;
    if (playerCount < 1 || playerCount > 4) return;
    if (mode === "single" && playerCount !== 2) return;
    if (mode === "team" && playerCount !== 4) return;
    const playersConfig = lobbyPlayers.map((p, idx) => ({
      name: p.name?.trim() || (p.isBot ? `Bot ${idx}` : `Spelare ${idx + 1}`),
      isBot: Boolean(p.isBot),
    }));
    const next = makeGame({ names: playersConfig.map((p) => p.name), mode, playersConfig });
    setGame(next);
    setTotals(Array(playerCount).fill(0));
    setSelectedIds([]);
    setHandOrder([]);
    setTransitioningToGame(true);
    if (startTransitionTimerRef.current) clearTimeout(startTransitionTimerRef.current);
    startTransitionTimerRef.current = setTimeout(() => {
      setStage("game");
      setTimeout(() => setTransitioningToGame(false), 260);
    }, 850);
  }

  const startNextRound = useCallback(() => {
    if (!isHost || !game?.roundEnded) return;
    const playersConfig = game.players.map((player, idx) => ({
      name: player.name?.trim() || (player.isBot ? `Bot ${idx}` : `Spelare ${idx + 1}`),
      isBot: Boolean(player.isBot),
    }));
    const next = makeGame({ names: playersConfig.map((player) => player.name), mode: game.mode, playersConfig });
    pointsAwardedRef.current = false;
    roundScoreAppliedRef.current = false;
    setRoundLeaderboardPoints(null);
    setRoundResult(null);
    setNextRoundCountdown(null);
    setSelectedIds([]);
    setHandOrder([]);
    setMobileSortMode(false);
    setMeldPlan(null);
    setExpandedTeamId(null);
    setTurnFlash(false);
    setInactiveFlash(false);
    setGame(next);
  }, [game, isHost]);

  function addBotToLobby() {
    if (typeof onAddBot === "function") {
      onAddBot();
    }
  }

  function removeLobbyPlayer(id) {
    if (!id) return;
    if (typeof onRemoveBot === "function") {
      onRemoveBot(id);
    }
  }

  useEffect(() => {
    if (!isHost || typeof onUpdateLobbyConfig !== "function") return;
    if (sharedLobbyMode === mode && sharedTargetScore === targetScore) return;
    onUpdateLobbyConfig({
      mode,
      targetScore,
    });
  }, [isHost, mode, targetScore, onUpdateLobbyConfig, sharedLobbyMode, sharedTargetScore]);

  useEffect(() => {
    if (stage !== "setup") return;
    const currentIds = syncedLobbyPlayers.map((p) => p.id);
    const previousIds = previousLobbyIdsRef.current;
    if (!previousIds.length) {
      previousLobbyIdsRef.current = currentIds;
      return;
    }

    if (currentIds.length > previousIds.length) {
      const joined = syncedLobbyPlayers.find((p) => !previousIds.includes(p.id));
      if (joined) {
        setLobbyStatus(`${joined.name} gick med i lobbyn.`);
      }
    } else if (currentIds.length < previousIds.length) {
      setLobbyStatus("En spelare lämnade lobbyn.");
    }

    previousLobbyIdsRef.current = currentIds;
  }, [stage, syncedLobbyPlayers]);

  useEffect(() => {
    if (!lobbyStatus) return;
    if (lobbyStatusTimerRef.current) clearTimeout(lobbyStatusTimerRef.current);
    lobbyStatusTimerRef.current = setTimeout(() => setLobbyStatus(""), 2600);
    return () => {
      if (lobbyStatusTimerRef.current) clearTimeout(lobbyStatusTimerRef.current);
    };
  }, [lobbyStatus]);

  useEffect(
    () => () => {
      if (startTransitionTimerRef.current) clearTimeout(startTransitionTimerRef.current);
      if (lobbyStatusTimerRef.current) clearTimeout(lobbyStatusTimerRef.current);
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
    },
    []
  );

  const handleBack = useCallback(() => {
    if (canastaStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(canastaStorageKey);
    }
    canastaMatchSyncRef.current = "";
    onBack?.();
  }, [canastaStorageKey, onBack]);

  function drawTwo() {
    if (!game || !isMyTurn || isBotTurn) return;
    setMobileSortMode(false);
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => drawTwoState(prev));
  }

  function takeDiscardStack() {
    if (!game || !isMyTurn || isBotTurn) return;
    setMobileSortMode(false);
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => takeDiscardStackState(prev, totals));
  }

  function discard(cardId) {
    if (!game || !isMyTurn || isBotTurn) return;
    setMobileSortMode(false);
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => discardState(prev, cardId));
  }

  const moveHandCard = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setHandOrder((prev) => {
      const base = prev.length ? [...prev] : orderedHand.map((c) => c.id);
      const from = base.indexOf(fromId);
      const to = base.indexOf(toId);
      if (from < 0 || to < 0) return base;
      const next = [...base];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
    setHoverCardId(null);
    setHandDropSide(null);
  }, [orderedHand]);

  function toggleMobileSortMode() {
    if (!isMobile || !canSortHand) return;
    setMobileSortMode((prev) => {
      const next = !prev;
      if (!next) {
        setDragCardId(null);
        setHoverCardId(null);
        setHandDropSide(null);
        suppressTapRef.current = false;
      }
      return next;
    });
  }

  function tryDiscardSelected() {
    if (!game || !isMyTurn || isBotTurn || game.phase !== "discard" || game.roundEnded) return;
    if (selectedIds.length !== 1) {
      setGame((prev) => ({ ...prev, notice: "Markera exakt 1 kort för att slänga." }));
      return;
    }
    discard(selectedIds[0]);
  }

  function toggleSelect(cardId) {
    if (!game || !isMyTurn || isBotTurn || game.roundEnded || game.phase !== "discard") return;
    if (mobileSortMode) return;
    setMeldPlan(null);
    setSelectedIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  }

  function laySelected() {
    if (!game || !isMyTurn || isBotTurn || game.roundEnded || game.phase !== "discard") return;
    if (mobileSortMode) return;
    if (shouldUseMeldPlanner(game, selectedIds)) {
      setMeldPlan(createMeldPlan(game, selectedIds));
      return;
    }
    const { state: next, error } = applyMeldMany(game, selectedIds, totals);
    if (error) {
      setGame({ ...game, notice: error });
      return;
    }
    setSelectedIds([]);
    setMeldPlan(null);
    setGame(next);
  }

  function applyPlannedMeld() {
    if (!game || !meldPlan || !isMyTurn || isBotTurn || game.roundEnded || game.phase !== "discard") return;
    const { groups, error: groupError } = resolvePlannedGroups(game, meldPlan);
    if (groupError) {
      setMeldPlan((prev) => (prev ? { ...prev, error: groupError } : prev));
      return;
    }
    const { state: next, error } = applyMeldGroups(game, groups, meldPlan.selectedIds, totals);
    if (error) {
      setMeldPlan((prev) => (prev ? { ...prev, error } : prev));
      return;
    }
    setSelectedIds([]);
    setMeldPlan(null);
    setGame(next);
  }

  useEffect(() => {
    if (!game || game.roundEnded || !isHost) return undefined;
    const bot = game.players[game.turnIndex];
    if (!bot?.isBot) return undefined;

    const id = setTimeout(() => {
      setGame((prev) => {
        if (!prev || prev.roundEnded) return prev;
        const active = prev.players[prev.turnIndex];
        if (!active?.isBot) return prev;
        let next = prev;

        if (next.phase === "draw") {
          next = canTakeDiscard(next, totals) ? takeDiscardStackState(next, totals) : drawTwoState(next);
        }

        if (next.phase === "discard") {
          for (let i = 0; i < 4; i += 1) {
            const ids = pickBotMeldCardIds(next);
            if (!ids || ids.length === 0) break;
            const result = applyMeld(next, ids, totals);
            if (result.error) break;
            next = result.state;
          }
          const discardId = pickDiscardCardId(next.players[next.turnIndex]);
          if (discardId) next = discardState(next, discardId);
        }

        return next;
      });
    }, 760);

    return () => clearTimeout(id);
  }, [game, totals, isHost]);

  useEffect(() => {
    if (!myPlayer) return;
    setMeldPlan(null);
    setHandOrder((prev) => {
      const currentIds = myPlayer.hand.map((c) => c.id);
      if (isMobile && !mobileSortMode) {
        return sortHandCards(myPlayer.hand).map((card) => card.id);
      }
      const keep = prev.filter((id) => currentIds.includes(id));
      const missing = currentIds.filter((id) => !keep.includes(id));
      return [...keep, ...missing];
    });
    setSelectedIds((prev) => prev.filter((id) => myPlayer.hand.some((c) => c.id === id)));
    setDragCardId(null);
    setHoverCardId(null);
    setHandDropSide(null);
  }, [myPlayer, isMobile, mobileSortMode]);

  useEffect(() => {
    if (!myPlayer) {
      prevHandIdsRef.current = [];
      setRecentDrawnIds([]);
      return;
    }
    const currentIds = myPlayer.hand.map((card) => card.id);
    const previousIds = prevHandIdsRef.current;
    if (previousIds.length === 0) {
      setRecentDrawnIds([]);
    } else if (isMyTurn && game?.phase === "discard" && currentIds.length > previousIds.length) {
      setRecentDrawnIds(currentIds.filter((id) => !previousIds.includes(id)));
    } else if (!isMyTurn || game?.phase !== "discard") {
      setRecentDrawnIds([]);
    } else {
      setRecentDrawnIds((prev) => prev.filter((id) => currentIds.includes(id)));
    }
    prevHandIdsRef.current = currentIds;
  }, [myPlayer, game?.phase, isMyTurn]);

  useEffect(() => {
    if (!game?.roundEnded) {
      pointsAwardedRef.current = false;
      roundScoreAppliedRef.current = false;
      setRoundLeaderboardPoints(null);
      setRoundResult(null);
      setNextRoundCountdown(null);
      return;
    }

    const { scoresByTeam, winnerTeamId } = computeRoundResults(game);
    setRoundResult({ scoresByTeam, winnerTeamId });

    if (!roundScoreAppliedRef.current && canAuthorMatchUpdate) {
      roundScoreAppliedRef.current = true;
      setTotals((prev) => updateTotalsAfterRound(game, prev));
    }

    if (pointsAwardedRef.current) return;
    pointsAwardedRef.current = true;
    const winners = game.players.filter((player) => player.teamId === winnerTeamId);
    const humans = winners.filter((player) => !player.isBot).length;
    const bots = winners.filter((player) => player.isBot).length;
    const basePoints = humans * 4 + bots;
    const points = targetScore === 5000 ? basePoints / 2 : basePoints;
    const payload = {
      points,
      humans,
      bots,
      totalPlayers: game.players.length,
      teamId: winnerTeamId,
      roundScore: Number(scoresByTeam[winnerTeamId] || 0),
    };
    setRoundLeaderboardPoints(payload);
    if (typeof onLeaderboardPointsAwarded === "function" && points > 0) {
      onLeaderboardPointsAwarded(payload);
    }
  }, [game, onLeaderboardPointsAwarded, targetScore, canAuthorMatchUpdate]);

  useEffect(() => {
    if (!game?.roundEnded || !isHost) {
      setNextRoundCountdown(null);
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
      return;
    }

    const winnerTeamId = getMatchWinnerTeamId(game, totals, targetScore);
    if (winnerTeamId) {
      setNextRoundCountdown(null);
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
      return;
    }

    const durationSeconds = 15;
    setNextRoundCountdown(durationSeconds);

    if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
    if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);

    nextRoundIntervalRef.current = setInterval(() => {
      setNextRoundCountdown((prev) => {
        if (prev == null) return prev;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

    nextRoundTimerRef.current = setTimeout(() => {
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
      startNextRound();
    }, durationSeconds * 1000);

    return () => {
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
    };
  }, [game, totals, targetScore, isHost, startNextRound]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => {
      setIsMobile(mq.matches);
      setIsLandscapeViewport(window.innerWidth > window.innerHeight);
    };
    onChange();
    mq.addEventListener?.("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mq.removeEventListener?.("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  useEffect(() => {
    if (!game || game.roundEnded) return;
    const current = String(game.turnIndex);
    if (prevTurnRef.current == null) {
      prevTurnRef.current = current;
      return;
    }
    if (prevTurnRef.current !== current) {
      if (game.turnIndex === localPlayerIndex) {
        if (vibrateOnTurn && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([70, 45, 70]);
        }
        setSettingsOpen(false);
        setTurnFlash(true);
        if (turnFlashTimerRef.current) clearTimeout(turnFlashTimerRef.current);
        turnFlashTimerRef.current = setTimeout(() => setTurnFlash(false), 1450);
      }
    }
    prevTurnRef.current = current;
  }, [game, vibrateOnTurn, localPlayerIndex]);

  useEffect(
    () => () => {
      if (turnFlashTimerRef.current) clearTimeout(turnFlashTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!isMobile || !dragCardId || game?.roundEnded) return undefined;

    function updateHoverAndSide(clientX) {
      const resolved = resolveHandDropTarget(clientX);
      dragTargetRef.current = resolved;
      setHandDropSide(resolved.side);
      setHoverCardId(resolved.side ? null : resolved.targetId);
    }

    function onPointerMove(e) {
      updateHoverAndSide(e.clientX);
    }

    function onPointerUp(e) {
      const resolved = resolveHandDropTarget(e.clientX);
      dragTargetRef.current = resolved;
      const targetId = resolved.targetId;
      if (targetId && targetId !== dragCardId) moveHandCard(dragCardId, targetId);
      setDragCardId(null);
      setHoverCardId(null);
      setHandDropSide(null);
      dragTargetRef.current = { side: null, targetId: null };
      suppressTapRef.current = false;
    }

    function onPointerCancel() {
      setDragCardId(null);
      setHoverCardId(null);
      setHandDropSide(null);
      dragTargetRef.current = { side: null, targetId: null };
      suppressTapRef.current = false;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [isMobile, dragCardId, game?.roundEnded, moveHandCard, resolveHandDropTarget]);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    },
    []
  );

  const markActiveNow = useCallback(() => {
    if (inactiveFlash) setInactiveFlash(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!isMyTurn) return;
    inactivityTimerRef.current = setTimeout(() => {
      setInactiveFlash(true);
    }, 60000);
  }, [inactiveFlash, isMyTurn]);

  useEffect(() => {
    if (!isMyTurn) {
      setInactiveFlash(false);
      setMobileSortMode(false);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      pointerStartRef.current = null;
      pressedCardIdRef.current = null;
      return;
    }
    markActiveNow();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isMyTurn, markActiveNow]);

  useEffect(() => {
    const onActivity = () => markActiveNow();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [markActiveNow]);

  useEffect(() => {
    if (!dragCardId) return;
    suppressTapRef.current = true;
  }, [dragCardId]);

  if (stage === "setup") {
    const targetLobbySize = mode === "team" ? 4 : 2;
    const lobbyCount = lobbyPlayers.length;
    const humansInLobby = lobbyPlayers.filter((p) => !p.isBot).length;
    const botsInLobby = lobbyPlayers.filter((p) => p.isBot).length;
    const lobbySeats = seatTemplateList(targetLobbySize, isMobile);
    const seatPlayers = Array.from({ length: targetLobbySize }, (_, idx) => lobbyPlayers[idx] ?? null);
    const openSeatCount = Math.max(0, targetLobbySize - lobbyCount);
    return (
      <CanastaLobbySetup
        isMobile={isMobile}
        mode={mode}
        targetScore={targetScore}
        roomCode={roomCode}
        isHost={isHost}
        hostName={hostName}
        lobbyPlayers={lobbyPlayers}
        targetLobbySize={targetLobbySize}
        lobbyCount={lobbyCount}
        humansInLobby={humansInLobby}
        botsInLobby={botsInLobby}
        lobbySeats={lobbySeats}
        seatPlayers={seatPlayers}
        openSeatCount={openSeatCount}
        friends={friends}
        sentInvites={sentInvites}
        invitePanelOpen={invitePanelOpen}
        setInvitePanelOpen={setInvitePanelOpen}
        onSendRoomInvite={onSendRoomInvite}
        onShareRoom={onShareRoom}
        lobbyStatus={lobbyStatus}
        transitioningToGame={transitioningToGame}
        setMode={setMode}
        setTargetScore={setTargetScore}
        addBotToLobby={addBotToLobby}
        removeLobbyPlayer={removeLobbyPlayer}
        start={start}
        handleBack={handleBack}
      />
    );
  }

  if (!game || !activePlayer || !myPlayer) return null;

  const canTakeDiscardNow = canTakeDiscard(game, totals);
  const themeBgColor = externalSettings?.bgColor ?? "#0f172a";
  const themeGlow1 = externalSettings?.bgGlow1 ?? "#22c55e";
  const themeGlow2 = externalSettings?.bgGlow2 ?? "#38bdf8";
  const themeAccent = externalSettings?.accentColor ?? "#22c55e";
  const canCustomizeTheme = typeof setExternalSettings === "function";
  const cardBackImage = [
    "url('/12-an-hemskarm-logotyp.png')",
    "repeating-linear-gradient(45deg, rgba(255,255,255,.11) 0 6px, rgba(255,255,255,0) 6px 12px)",
    "linear-gradient(180deg, #14532d, #052e16)",
  ].join(", ");
  const dragIndex = dragCardId ? ids.indexOf(dragCardId) : -1;
  const hoverIndex = hoverCardId ? ids.indexOf(hoverCardId) : -1;
  const handOffsetAt = (i) => {
    let shift = 0;
    if (dragIndex >= 0 && hoverIndex >= 0 && i !== dragIndex) {
      if (hoverIndex > dragIndex && i > dragIndex && i <= hoverIndex) shift = -38;
      if (hoverIndex < dragIndex && i >= hoverIndex && i < dragIndex) shift = 38;
    }
    return (i - handCenter) * handStep + shift;
  };

  let dropMarkerX = null;
  if (dragIndex >= 0 && orderedHand.length > 0) {
    if (handDropSide === "left") {
      dropMarkerX = handOffsetAt(0) - handStep * 0.58;
    } else if (handDropSide === "right") {
      dropMarkerX = handOffsetAt(orderedHand.length - 1) + handStep * 0.58;
    } else if (hoverIndex >= 0) {
      if (hoverIndex > dragIndex) dropMarkerX = handOffsetAt(hoverIndex) + handStep * 0.5;
      else if (hoverIndex < dragIndex) dropMarkerX = handOffsetAt(hoverIndex) - handStep * 0.5;
      else dropMarkerX = handOffsetAt(hoverIndex);
    }
  }

  const selectedForPlan = meldPlan ? myPlayer.hand.filter((c) => meldPlan.selectedIds.includes(c.id)) : [];
  const selectedCards = myPlayer.hand.filter((c) => selectedIds.includes(c.id));
  const wildForPlan = selectedForPlan.filter((c) => isWild(c));
  const planPreview = meldPlan ? resolvePlannedGroups(game, meldPlan) : { groups: [], error: null };
  const activePlanCard = meldPlan ? wildForPlan.find((c) => c.id === meldPlan.activeCardId) ?? null : null;
  const activePlanTargets = activePlanCard
    ? isWild(activePlanCard)
      ? meldPlan.targetRanks
      : [activePlanCard.rank]
    : [];
  const planPreviewCards = planPreview.groups.map((ids) =>
    ids.map((id) => selectedForPlan.find((c) => c.id === id)).filter(Boolean)
  );
  const expandedTeam = expandedTeamId ? teamZones.find((z) => z.teamId === expandedTeamId) ?? null : null;
  const matchWinnerTeamId = game?.roundEnded ? getMatchWinnerTeamId(game, totals, targetScore) : null;
  const matchWinnerLabel = matchWinnerTeamId
    ? teamZones.find((zone) => zone.teamId === matchWinnerTeamId)?.label ??
      game.players.find((player) => player.teamId === matchWinnerTeamId)?.name ??
      matchWinnerTeamId
    : null;
  const scoreEntries =
    game.mode === "team"
      ? teamZones.map((zone) => ({
          key: zone.teamId,
          label: zone.label,
          total: teamTotals[zone.teamId] ?? 0,
          opening: openingRequirement(teamTotals[zone.teamId] ?? 0),
        }))
      : game.players.map((player, index) => ({
          key: player.id,
          label: player.name,
          total: Number(totals[index] || 0),
          opening: openingByPlayer[index],
        }));
  const scoreCards = (
    <div style={{ display: "grid", gridTemplateColumns: isMobileLandscape ? "1fr" : "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
      {scoreEntries.map((entry) => (
        <div
          key={`${entry.key}-score`}
          style={{
            display: "grid",
            gap: 4,
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,.25)",
            background: "rgba(15,23,42,.45)",
            padding: "10px 12px",
          }}
        >
          <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>{entry.label} totalpoäng</div>
          <div style={{ color: "#f8fafc", fontSize: 22, fontWeight: 900 }}>
            {Number(entry.total || 0).toLocaleString("sv-SE")}
          </div>
          <div style={{ color: "#fde68a", fontWeight: 700, fontSize: 11 }}>
            Öppning: {entry.opening === "canasta" ? "Canasta" : entry.opening}
          </div>
        </div>
      ))}
    </div>
  );
  const infoNote = (
    <div style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>
      Kasthögen tas nu i sin helhet, frusen hög hanteras separat och rondpoäng räknas automatiskt.
    </div>
  );
  const showLandscapeHandOverview = isMobileLandscape && !mobileSortMode;
  const canDrawFromStock = game.phase === "draw" && !game.roundEnded && !isBotTurn && isMyTurn;
  const canPickDiscardPile = canDrawFromStock && canTakeDiscardNow;
  const canLaySelectedCards = game.phase === "discard" && selectedIds.length > 0 && !game.roundEnded && !isBotTurn && isMyTurn;
  const canDiscardSelectedCard = game.phase === "discard" && selectedIds.length === 1 && !game.roundEnded && !isBotTurn && isMyTurn;
  const myTeamId = myPlayer?.teamId ?? null;
  const myTeam = game.teams?.[myTeamId] ?? null;
  const openingTarget = openingRequirement(getPlayerOpeningTotal(game, totals, localPlayerIndex));
  const selectedPositivePoints = selectedCards.reduce((acc, card) => acc + Math.max(0, cardPoints(card)), 0);
  const selectedNaturalRanks = [...new Set(selectedCards.filter((card) => !isWild(card) && card.rank !== 3).map((card) => card.rank))];
  const primarySelectedRank = selectedNaturalRanks.length === 1 ? selectedNaturalRanks[0] : null;
  const selectedExistingMeld = primarySelectedRank != null ? myTeam?.melds?.find((meld) => meld.rank === primarySelectedRank) ?? null : null;
  const selectedNeedsPlanner = selectedIds.length > 0 && shouldUseMeldPlanner(game, selectedIds);
  const selectedLayPreview =
    selectedIds.length > 0 && !selectedNeedsPlanner ? applyMeldMany(game, selectedIds, totals) : null;
  const selectedCanLayNow = Boolean(
    selectedIds.length > 0 && game.phase === "discard" && !game.roundEnded && !isBotTurn && isMyTurn && (selectedNeedsPlanner || !selectedLayPreview?.error)
  );
  const selectedPickupMatchCount =
    topDiscard && !isWild(topDiscard) && !topDiscard.joker
      ? selectedCards.filter((card) => !isWild(card) && card.rank === topDiscard.rank).length
      : 0;
  const selectedMakesDiscardPickup = selectedPickupMatchCount >= 2;
  const openingValueLabel =
    openingTarget === "canasta"
      ? `${selectedCards.length} kort / Canasta`
      : `${selectedPositivePoints} / ${openingTarget}`;
  const openingStatus = myTeam?.opened
    ? "Laget är öppnat"
    : openingTarget === "canasta"
      ? selectedCanLayNow
        ? "Du kan öppna med canasta"
        : "Öppningskrav: Canasta"
      : selectedPositivePoints >= Number(openingTarget)
        ? "Du kan öppna"
        : `Du saknar ${Math.max(0, Number(openingTarget) - selectedPositivePoints)} poäng för öppning`;
  const discardStatus = game.discardFrozen
    ? selectedMakesDiscardPickup
      ? "Frusen hög, men markerat par kan ta den"
      : "Kasthögen är frusen"
    : canPickDiscardPile
      ? "Kasthögen är möjlig att ta"
      : selectedMakesDiscardPickup
        ? "Markerade kort gör högen möjlig att ta"
        : "Kasthögen kan inte tas nu";
  const intentLabel =
    selectedIds.length === 0
      ? ""
      : selectedNeedsPlanner
        ? "Lägg ut i flera stick"
        : selectedExistingMeld
          ? `Lägg till i ${rankLabel(primarySelectedRank)}`
          : primarySelectedRank != null
            ? `Skapa ny meld: ${rankLabel(primarySelectedRank)}`
            : "";
  const selectedSummary = {
    teamOpened: Boolean(myTeam?.opened),
    openingValueLabel,
    openingStatus,
    discardStatus,
    canOpenNow: !myTeam?.opened && selectedCanLayNow,
    canLayNow: selectedCanLayNow,
    targetExistingRank: selectedExistingMeld?.rank ?? null,
    intentLabel,
    intentActionLabel: intentLabel || "Lägg ut",
    turnStepLabel:
      game.phase === "draw"
        ? "Steg 1 av 3: Dra"
        : canDiscardSelectedCard
          ? "Steg 3 av 3: Kasta"
          : "Steg 2 av 3: Lägg ut",
    centerHeadline:
      game.phase === "draw"
        ? canPickDiscardPile
          ? "Välj mellan talong och kasthög"
          : "Tryck på talongen för att dra två kort"
        : selectedIds.length > 0
          ? intentLabel || actionHint
          : canDiscardSelectedCard
            ? "Du kan kasta det markerade kortet"
            : actionHint,
    centerDetail:
      game.phase === "draw"
        ? discardStatus
        : selectedIds.length > 0
          ? openingStatus
          : "Markera kort i handen för att skapa ny meld eller bygga vidare på en befintlig.",
    actionTitle:
      selectedIds.length > 0
        ? `${selectedIds.length} markerade kort`
        : game.phase === "draw"
          ? "Dra kort"
          : "Välj drag",
    actionSubtitle:
      selectedIds.length > 0
        ? `${openingStatus}${intentLabel ? ` • ${intentLabel}` : ""}`
        : discardStatus,
    restingTitle: game.phase === "draw" ? "Steg 1: dra" : "Steg 2-3: lägg ut eller kasta",
    restingSubtitle: game.phase === "draw" ? discardStatus : openingStatus,
  };
  const actionHint = "";

  const clearSelected = () => {
    setMeldPlan(null);
    setSelectedIds([]);
  };

  const sortHandNow = () => {
    if (!myPlayer) return;
    setMobileSortMode(false);
    setDragCardId(null);
    setHoverCardId(null);
    setHandDropSide(null);
    setHandOrder(sortHandCards(myPlayer.hand).map((card) => card.id));
  };

  return (
    <div
      style={{
        padding: isMobile ? "10px 10px 0" : 14,
        display: "grid",
        gap: 10,
        minHeight: "100%",
        backgroundImage: isMobile
          ? [
              "radial-gradient(140% 120% at 50% 0%, rgba(255,255,255,.03), transparent 55%)",
              "radial-gradient(120% 120% at 50% 40%, rgba(16,185,129,.07), transparent 74%)",
              "linear-gradient(180deg, #081313, #071015 72%, #050b13)",
            ].join(", ")
          : "none",
      }}
    >
      <style>{`
        @keyframes canastaTurnBlink {
          0%, 100% { opacity: 0; }
          18%, 58% { opacity: .58; }
        }
        @keyframes canastaTurnText {
          0% { opacity: 0; transform: translate(-50%, -48%) scale(.9); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1.03); }
          100% { opacity: 0; transform: translate(-50%, -52%) scale(1); }
        }
        @keyframes canastaIdleBlink {
          0%, 100% { opacity: 0; }
          50% { opacity: .52; }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 34, lineHeight: 1, letterSpacing: isMobile ? ".02em" : 0 }}>Canasta</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                padding: isMobile ? "4px 9px" : "5px 10px",
                borderRadius: 999,
                background: isBotTurn ? "rgba(148,163,184,.08)" : "rgba(56,189,248,.1)",
                color: isBotTurn ? "#cbd5e1" : "#a5f3fc",
                border: `1px solid ${isBotTurn ? "rgba(148,163,184,.12)" : "rgba(56,189,248,.14)"}`,
                fontWeight: 800,
                fontSize: isMobile ? 10 : 11,
              }}
            >
              {isBotTurn ? "Botens tur" : isMyTurn ? "Din tur" : `${activePlayer.name}s tur`}
            </div>
            {!isMobile ? (
              <div
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "rgba(148,163,184,.1)",
                  color: "#cbd5e1",
                  border: "1px solid rgba(148,163,184,.14)",
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                {selectedSummary.turnStepLabel}
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            variant="ghost"
            onClick={() => setSettingsOpen((s) => !s)}
            style={{
              width: "auto",
              padding: isMobile ? "6px 10px" : undefined,
              opacity: isMobile ? 0.78 : 1,
              background: isMobile ? "rgba(8,15,28,.34)" : undefined,
              border: isMobile ? "none" : undefined,
              backdropFilter: isMobile ? "blur(10px)" : undefined,
            }}
          >
            Inställningar
          </Button>
          <Button
            variant="ghost"
            onClick={handleBack}
            style={{
              width: "auto",
              padding: isMobile ? "6px 10px" : undefined,
              opacity: isMobile ? 0.68 : 1,
              background: isMobile ? "rgba(8,15,28,.24)" : undefined,
              border: isMobile ? "none" : undefined,
              backdropFilter: isMobile ? "blur(10px)" : undefined,
            }}
          >
            Avsluta
          </Button>
        </div>
      </div>

      {!isMobile ? <div style={{ color: "var(--muted)", fontWeight: 700 }}>{game.notice}</div> : null}
      <CanastaBoardView
        isMobile={isMobile}
        isMobileLandscape={isMobileLandscape}
        game={game}
        teamZones={teamZones}
        roundResult={roundResult}
        roundLeaderboardPoints={roundLeaderboardPoints}
        matchWinnerLabel={matchWinnerLabel}
        matchWinnerTeamId={matchWinnerTeamId}
        targetScore={targetScore}
        nextRoundCountdown={nextRoundCountdown}
        isHost={isHost}
        startNextRound={startNextRound}
        actionHint={actionHint}
        isBotTurn={isBotTurn}
        turnFlash={turnFlash}
        inactiveFlash={inactiveFlash}
        themeAccent={themeAccent}
        themeGlow1={themeGlow1}
        themeGlow2={themeGlow2}
        themeBgColor={themeBgColor}
        cardBackImage={cardBackImage}
        canDrawFromStock={canDrawFromStock}
        drawTwo={drawTwo}
        topDiscard={topDiscard}
        canPickDiscardPile={canPickDiscardPile}
        takeDiscardStack={takeDiscardStack}
        tryDiscardSelected={tryDiscardSelected}
        dragCardId={dragCardId}
        discard={discard}
        setHoverCardId={setHoverCardId}
        canDiscardSelectedCard={canDiscardSelectedCard}
        visibleTeamZones={visibleTeamZones}
        seatTemplates={seatTemplates}
        myPlayerId={myPlayer.id}
        myTeamId={myTeamId}
        canLaySelectedCards={canLaySelectedCards}
        selectedIds={selectedIds}
        selectedCards={selectedCards}
        selectedSummary={selectedSummary}
        laySelected={laySelected}
        setExpandedTeamId={setExpandedTeamId}
        renderCardFace={(card, compact) => <CanastaFace card={card} compact={compact} />}
        renderTeamMelds={(props) => <TeamMelds {...props} />}
        getTeamTotal={(teamId) => getTeamTotalFromTotals(game, totals, teamId)}
        rankLabel={rankLabel}
      />

      <CanastaHandPanel
        isMobile={isMobile}
        myPlayer={myPlayer}
        mobileSortMode={mobileSortMode}
        toggleMobileSortMode={toggleMobileSortMode}
        canSortHand={canSortHand}
        showLandscapeHandOverview={showLandscapeHandOverview}
        orderedHand={orderedHand}
        selectedIds={selectedIds}
        selectedSummary={selectedSummary}
        recentDrawnIds={recentDrawnIds}
        suppressTapRef={suppressTapRef}
        toggleSelect={toggleSelect}
        handAreaRef={handAreaRef}
        handAreaHeight={handAreaHeight}
        dragCardId={dragCardId}
        handReorderEnabled={handReorderEnabled}
        resolveHandDropTarget={resolveHandDropTarget}
        setHandDropSide={setHandDropSide}
        setHoverCardId={setHoverCardId}
        moveHandCard={moveHandCard}
        handDropSide={handDropSide}
        dropMarkerX={dropMarkerX}
        handOffsetAt={handOffsetAt}
        handCenter={handCenter}
        hoverCardId={hoverCardId}
        pressedCardIdRef={pressedCardIdRef}
        pointerStartRef={pointerStartRef}
        longPressTimerRef={longPressTimerRef}
        setDragCardId={setDragCardId}
        handCardWidth={handCardWidth}
        handCardHeight={handCardHeight}
        renderCardFace={(card, compact) => <CanastaFace card={card} compact={compact} />}
        clearSelected={clearSelected}
        sortHandNow={sortHandNow}
        drawTwo={drawTwo}
        takeDiscardStack={takeDiscardStack}
        tryDiscardSelected={tryDiscardSelected}
        laySelected={laySelected}
        canDrawFromStock={canDrawFromStock}
        canPickDiscardPile={canPickDiscardPile}
        canDiscardSelectedCard={canDiscardSelectedCard}
        canLaySelectedCards={canLaySelectedCards}
      />

      {!isMobile ? scoreCards : null}
      {!isMobile ? infoNote : null}
      <CanastaMeldPlanModal
        meldPlan={meldPlan}
        selectedForPlan={selectedForPlan}
        wildForPlan={wildForPlan}
        activePlanCard={activePlanCard}
        activePlanTargets={activePlanTargets}
        planPreview={planPreview}
        planPreviewCards={planPreviewCards}
        cardLabel={cardLabel}
        rankLabel={rankLabel}
        setMeldPlan={setMeldPlan}
        applyPlannedMeld={applyPlannedMeld}
        renderCardFace={(card, compact) => <CanastaFace card={card} compact={compact} />}
      />
      <CanastaExpandedTeamModal
        expandedTeam={expandedTeam}
        setExpandedTeamId={setExpandedTeamId}
        buildMeldPreviewCards={buildMeldPreviewCards}
        rankLabel={rankLabel}
        renderCardFace={(card, compact) => <CanastaFace card={card} compact={compact} />}
      />
      <CanastaSettingsModal
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        vibrateOnTurn={vibrateOnTurn}
        setVibrateOnTurn={setVibrateOnTurn}
        roomCode={roomCode}
        lobbyPlayers={lobbyPlayers}
        mode={mode}
        hostName={hostName}
        onShareRoom={onShareRoom}
        targetScore={targetScore}
        friends={friends}
        sentInvites={sentInvites}
        onSendRoomInvite={onSendRoomInvite}
        canCustomizeTheme={canCustomizeTheme}
        applyTheme={applyTheme}
        themes={themes}
        themeCategory={themeCategory}
        setThemeCategory={setThemeCategory}
        standardThemes={standardThemes}
        specialThemes={specialThemes}
        visibleThemes={visibleThemes}
        externalSettings={externalSettings}
        themeBgColor={themeBgColor}
        themeAccent={themeAccent}
        themeGlow1={themeGlow1}
        themeGlow2={themeGlow2}
        setExternalSettings={setExternalSettings}
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { leaveRoom } from "./services/leave";
import { touchPlayer } from "./services/presence";

import { Container } from "./ui/Container";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

import ScoreSheet from "./components/ScoreSheet";
import DiceTray, { DieFace } from "./components/DiceTray";
import { rowWeight } from "./utils/probability";

import {
  createRoomWithCode,
  getRoomByCode,
  getPlayerByDevice,
  createPlayer,
  ensureScore,
} from "./services/rooms";

function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function getOrCreateDeviceId() {
  const key = "scoreboard_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id =
      globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function emptyProgress() {
  const obj = {};
  for (let r = 1; r <= 12; r++) obj[r] = Array(7).fill(false);
  return obj;
}

function isProgressWin(p) {
  for (let r = 1; r <= 12; r++) {
    const row = p?.[r];
    if (!row || row.length !== 7 || !row.every(Boolean)) return false;
  }
  return true;
}

function calcWeightedProgress(progressObj) {
  if (!progressObj) return 0;

  let done = 0;
  let total = 0;

  for (let r = 1; r <= 12; r++) {
    const w = rowWeight(r);
    const row = progressObj[r] ?? Array(7).fill(false);
    for (let i = 0; i < 7; i++) {
      total += w;
      if (row[i]) done += w;
    }
  }

  return total > 0 ? done / total : 0;
}

function normalizeProgress(p) {
  if (!p) return emptyProgress();
  if (typeof p === "string") {
    try {
      return JSON.parse(p) ?? emptyProgress();
    } catch {
      return emptyProgress();
    }
  }
  if (typeof p === "object") return p;
  return emptyProgress();
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function countCompletedRows(progressObj) {
  let rows = 0;
  for (let r = 1; r <= 12; r++) {
    const row = progressObj?.[r] ?? [];
    if (row.length === 7 && row.every(Boolean)) rows++;
  }
  return rows;
}

const BG_PATTERNS = {
  none: { image: "none", size: "160px" },
  moon: { image: "none", size: "160px" },
  waves: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'120\' viewBox=\'0 0 200 120\'><path d=\'M0 40 Q25 20 50 40 T100 40 T150 40 T200 40\' fill=\'none\' stroke=\'%23a5f3fc\' stroke-opacity=\'0.35\' stroke-width=\'2\'/><path d=\'M0 80 Q25 60 50 80 T100 80 T150 80 T200 80\' fill=\'none\' stroke=\'%2393c5fd\' stroke-opacity=\'0.35\' stroke-width=\'2\'/></svg>")',
    size: "220px",
  },
  forest: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\' viewBox=\'0 0 160 160\'><path d=\'M20 130 L40 80 L60 130 Z\' fill=\'%2316a34a\' fill-opacity=\'0.22\'/><path d=\'M80 130 L100 70 L120 130 Z\' fill=\'%2322c55e\' fill-opacity=\'0.20\'/><circle cx=\'40\' cy=\'50\' r=\'2\' fill=\'%2384cc16\' fill-opacity=\'0.4\'/></svg>")',
    size: "180px",
  },
  embers: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'140\' height=\'140\' viewBox=\'0 0 140 140\'><circle cx=\'30\' cy=\'30\' r=\'2\' fill=\'%23f97316\' fill-opacity=\'0.45\'/><circle cx=\'90\' cy=\'50\' r=\'1.5\' fill=\'%23f59e0b\' fill-opacity=\'0.45\'/><circle cx=\'60\' cy=\'100\' r=\'2\' fill=\'%23f97316\' fill-opacity=\'0.35\'/></svg>")',
    size: "160px",
  },
  petals: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\' viewBox=\'0 0 160 160\'><ellipse cx=\'40\' cy=\'40\' rx=\'8\' ry=\'4\' fill=\'%23fb7185\' fill-opacity=\'0.22\'/><ellipse cx=\'120\' cy=\'70\' rx=\'6\' ry=\'3\' fill=\'%23f472b6\' fill-opacity=\'0.22\'/><ellipse cx=\'80\' cy=\'120\' rx=\'7\' ry=\'3.5\' fill=\'%23fb7185\' fill-opacity=\'0.2\'/></svg>")',
    size: "180px",
  },
  blossom-trees: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'220\' height=\'160\' viewBox=\'0 0 220 160\'><path d=\'M0 120 C40 80 90 80 140 110 C170 130 200 120 220 100\' fill=\'none\' stroke=\'%238b5e3c\' stroke-opacity=\'0.25\' stroke-width=\'3\'/><circle cx=\'40\' cy=\'80\' r=\'4\' fill=\'%23f9a8d4\' fill-opacity=\'0.32\'/><circle cx=\'60\' cy=\'70\' r=\'3\' fill=\'%23f472b6\' fill-opacity=\'0.3\'/><circle cx=\'90\' cy=\'75\' r=\'3\' fill=\'%23fbcfe8\' fill-opacity=\'0.35\'/><circle cx=\'120\' cy=\'90\' r=\'3\' fill=\'%23f9a8d4\' fill-opacity=\'0.3\'/><circle cx=\'160\' cy=\'95\' r=\'4\' fill=\'%23f472b6\' fill-opacity=\'0.28\'/></svg>")',
    size: "240px",
  },
  snow: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\' viewBox=\'0 0 180 180\'><g stroke=\'%23e0f2fe\' stroke-opacity=\'0.5\' stroke-width=\'1\' fill=\'none\'><path d=\'M30 30 L30 45\'/><path d=\'M24 36 L36 36\'/><path d=\'M26 32 L34 40\'/><path d=\'M34 32 L26 40\'/></g><g stroke=\'%23bae6fd\' stroke-opacity=\'0.45\' stroke-width=\'1\' fill=\'none\'><path d=\'M120 60 L120 74\'/><path d=\'M113 67 L127 67\'/><path d=\'M115 63 L125 71\'/><path d=\'M125 63 L115 71\'/></g><circle cx=\'70\' cy=\'120\' r=\'1.6\' fill=\'%23e0f2fe\' fill-opacity=\'0.5\'/><circle cx=\'140\' cy=\'130\' r=\'1.2\' fill=\'%23bae6fd\' fill-opacity=\'0.5\'/></svg>")',
    size: "220px",
  },
  paws: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\' viewBox=\'0 0 180 180\'><g fill=\'%23cbd5f5\' fill-opacity=\'0.22\'><circle cx=\'40\' cy=\'40\' r=\'6\'/><circle cx=\'55\' cy=\'35\' r=\'4\'/><circle cx=\'25\' cy=\'35\' r=\'4\'/><circle cx=\'40\' cy=\'55\' r=\'4\'/></g><g fill=\'%23e2e8f0\' fill-opacity=\'0.18\'><circle cx=\'120\' cy=\'110\' r=\'6\'/><circle cx=\'135\' cy=\'105\' r=\'4\'/><circle cx=\'105\' cy=\'105\' r=\'4\'/><circle cx=\'120\' cy=\'125\' r=\'4\'/></g></svg>")',
    size: "200px",
  },
  stars: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\' viewBox=\'0 0 200 200\'><circle cx=\'30\' cy=\'40\' r=\'1.5\' fill=\'%23c4b5fd\' fill-opacity=\'0.6\'/><circle cx=\'160\' cy=\'60\' r=\'1.2\' fill=\'%23ddd6fe\' fill-opacity=\'0.5\'/><circle cx=\'120\' cy=\'140\' r=\'1.4\' fill=\'%23c4b5fd\' fill-opacity=\'0.5\'/></svg>")',
    size: "220px",
  },
  crystals: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\' viewBox=\'0 0 180 180\'><path d=\'M40 140 L60 90 L80 140 Z\' fill=\'%2393c5fd\' fill-opacity=\'0.22\'/><path d=\'M100 140 L120 80 L140 140 Z\' fill=\'%2360a5fa\' fill-opacity=\'0.2\'/></svg>")',
    size: "200px",
  },
  lava: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'140\' viewBox=\'0 0 200 140\'><path d=\'M0 100 L40 80 L80 100 L120 70 L160 100 L200 80\' fill=\'none\' stroke=\'%23fb923c\' stroke-opacity=\'0.35\' stroke-width=\'2\'/><path d=\'M0 120 L50 110 L90 120 L130 95 L170 120 L200 110\' fill=\'none\' stroke=\'%23f97316\' stroke-opacity=\'0.3\' stroke-width=\'2\'/></svg>")',
    size: "220px",
  },
};


export default function App() {
  const [deviceId] = useState(() => getOrCreateDeviceId());

  const [step, setStep] = useState("home"); // home | room | solo
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [showInspect, setShowInspect] = useState(false);
  const [inspectPlayerId, setInspectPlayerId] = useState(null);

  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem("scoreboard_settings_v1");
      return raw
        ? JSON.parse(raw)
        : {
            boxSize: "medium",
            checkColor: "#22c55e",
            rowCompleteBg: "#1f3b2e",
            accentColor: "#22c55e",
            bgColor: "#0b1020",
            bgGlow1: "#38bdf8",
            bgGlow2: "#22c55e",
            bgPattern: "none",
            bgPatternOpacity: 0.25,
            buttonIcon: "",
            showDice: false,
            vibrateOnTurn: false,
          };
    } catch {
      return {
        boxSize: "medium",
        checkColor: "#22c55e",
        rowCompleteBg: "#1f3b2e",
        accentColor: "#22c55e",
        bgColor: "#0b1020",
        bgGlow1: "#38bdf8",
        bgGlow2: "#22c55e",
        bgPattern: "none",
        bgPatternOpacity: 0.25,
        buttonIcon: "",
        showDice: false,
        vibrateOnTurn: false,
      };
    }
  });

  useEffect(() => {
    localStorage.setItem("scoreboard_settings_v1", JSON.stringify(settings));
    const root = document.documentElement;
    if (settings.bgColor) root.style.setProperty("--bg", settings.bgColor);
    if (settings.accentColor) root.style.setProperty("--accent", settings.accentColor);
    if (settings.bgGlow1) root.style.setProperty("--bg-glow-1", settings.bgGlow1);
    if (settings.bgGlow2) root.style.setProperty("--bg-glow-2", settings.bgGlow2);
    const patternKey = settings.bgPattern || "none";
    const pattern = BG_PATTERNS[patternKey] ?? BG_PATTERNS.none;
    root.style.setProperty("--bg-pattern", pattern.image);
    root.style.setProperty("--bg-pattern-size", pattern.size);
    root.style.setProperty("--bg-pattern-opacity", String(settings.bgPatternOpacity ?? 0.25));
    document.body.dataset.theme = patternKey === "none" ? "custom" : patternKey;
  }, [settings]);

  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);
  const [followActivePlayer, setFollowActivePlayer] = useState(false);

  const themes = [
    {
      name: "Midnight",
      bgColor: "#0c0b06",
      accentColor: "#f5c542",
      rowCompleteBg: "#3a2a12",
      bgGlow1: "#f5c542",
      bgGlow2: "#f59e0b",
      bgPattern: "moon",
      buttonIcon: "",
    },
    {
      name: "Ocean",
      bgColor: "#0b1220",
      accentColor: "#38bdf8",
      rowCompleteBg: "#0f2b3a",
      bgGlow1: "#0ea5e9",
      bgGlow2: "#14b8a6",
      bgPattern: "waves",
      buttonIcon: "",
    },
    {
      name: "Forest",
      bgColor: "#0b1110",
      accentColor: "#34d399",
      rowCompleteBg: "#123326",
      bgGlow1: "#14532d",
      bgGlow2: "#22c55e",
      bgPattern: "forest",
      buttonIcon: "",
    },
    {
      name: "Amber",
      bgColor: "#15100a",
      accentColor: "#f59e0b",
      rowCompleteBg: "#3a250f",
      bgGlow1: "#f97316",
      bgGlow2: "#f59e0b",
      bgPattern: "embers",
      buttonIcon: "",
    },
    {
      name: "Rose",
      bgColor: "#160b12",
      accentColor: "#fb7185",
      rowCompleteBg: "#3a1a24",
      bgGlow1: "#fb7185",
      bgGlow2: "#f472b6",
      bgPattern: "petals",
      buttonIcon: "♥",
    },
    {
      name: "Cherry Blossom",
      bgColor: "#160c10",
      accentColor: "#f9a8d4",
      rowCompleteBg: "#3a1820",
      bgGlow1: "#f9a8d4",
      bgGlow2: "#f472b6",
      bgPattern: "blossom-trees",
      buttonIcon: "✿",
    },
    {
      name: "Otis",
      bgColor: "#0b0b0b",
      accentColor: "#f8fafc",
      rowCompleteBg: "#1f1f1f",
      bgGlow1: "#94a3b8",
      bgGlow2: "#f8fafc",
      bgPattern: "paws",
      buttonIcon:
        "data:image/svg+xml;utf8," +
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
        "<g stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
        "<path d='M10 26 C4 22 3 14 8 12 C14 10 20 16 22 22' fill='%23000'/>" +
        "<path d='M54 26 C60 22 61 14 56 12 C50 10 44 16 42 22' fill='%23000'/>" +
        "<path d='M12 30 C12 18 22 10 32 10 C42 10 52 18 52 30 C52 42 42 52 32 52 C22 52 12 42 12 30 Z' fill='%23000'/>" +
        "<path d='M18 18 q2 2 0 4 q-2 2 0 4' fill='none'/>" +
        "<path d='M46 18 q-2 2 0 4 q2 2 0 4' fill='none'/>" +
        "<path d='M24 14 q2 2 0 4 q-2 2 0 4' fill='none'/>" +
        "<path d='M40 14 q-2 2 0 4 q2 2 0 4' fill='none'/>" +
        "<path d='M18 40 C20 34 24 30 32 30 C40 30 44 34 46 40 C44 46 38 50 32 50 C26 50 20 46 18 40 Z' fill='%23fff'/>" +
        "<path d='M20 38 C22 36 26 34 32 34 C38 34 42 36 44 38' fill='none' stroke='%23fff'/>" +
        "<circle cx='24' cy='28' r='2.2' fill='%23fff'/>" +
        "<circle cx='40' cy='28' r='2.2' fill='%23fff'/>" +
        "<circle cx='32' cy='36' r='3' fill='%23000'/>" +
        "<path d='M32 39 Q32 42 28 44' stroke='%23000' fill='none'/>" +
        "<path d='M32 39 Q32 42 36 44' stroke='%23000' fill='none'/>" +
        "<path d='M16 50 Q22 46 28 50' fill='%23fff'/>" +
        "<path d='M36 50 Q42 46 48 50' fill='%23fff'/>" +
        "</g>" +
        "</svg>",
    },
    {
      name: "Stars",
      bgColor: "#0a0f1a",
      accentColor: "#a78bfa",
      rowCompleteBg: "#1f1b3a",
      bgGlow1: "#7c3aed",
      bgGlow2: "#a78bfa",
      bgPattern: "stars",
      buttonIcon: "★",
    },
    {
      name: "Ice",
      bgColor: "#0b1218",
      accentColor: "#93c5fd",
      rowCompleteBg: "#16263a",
      bgGlow1: "#93c5fd",
      bgGlow2: "#38bdf8",
      bgPattern: "snow",
      buttonIcon: "❄",
    },
    {
      name: "Lava",
      bgColor: "#150b0b",
      accentColor: "#f97316",
      rowCompleteBg: "#3a1a0f",
      bgGlow1: "#f97316",
      bgGlow2: "#ef4444",
      bgPattern: "lava",
      buttonIcon: "✹",
    },
  ];

  const progressStorageKey = useMemo(() => {
    if (roomId && playerId) return `t12_progress_${roomId}_${playerId}`;
    return "t12_progress_local";
  }, [roomId, playerId]);

  const [progress, setProgress] = useState(() => emptyProgress());
  const [showWin, setShowWin] = useState(false);

  // Dice state (optional)
  const [dice, setDice] = useState(() => Array(6).fill(1));
  const [locked, setLocked] = useState(() => Array(6).fill(false));
  const [previewLocked, setPreviewLocked] = useState(() => Array(6).fill(false));
  const [target, setTarget] = useState(null); // 1..12, null until chosen
  const [lastGain, setLastGain] = useState(0);
  const [diceStatus, setDiceStatus] = useState("idle"); // idle | choose | running | stopped | all
  const [targetLocked, setTargetLocked] = useState(false);
  const [rolling, setRolling] = useState(false);
  const rollTimerRef = useRef(null);
  const [turnFlash, setTurnFlash] = useState(false);

  const isSolo = step === "solo";

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
    if (!roomId || !playerId) return;
    const payload = {
      room_id: roomId,
      player_id: playerId,
      progress,
      last_dice: dice,
      last_target: target,
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
  }, [roomId, playerId, progress, dice, target]);

  const resetTurnState = () => {
    setDiceStatus("idle");
    setTarget(null);
    setLocked(Array(6).fill(false));
    setPreviewLocked(Array(6).fill(false));
    setLastGain(0);
    setTargetLocked(false);
  };

  const TOTAL_BOXES = 12 * 7;

  const completedBoxes = useMemo(() => {
    let c = 0;
    for (let r = 1; r <= 12; r++) {
      const row = progress?.[r] ?? [];
      for (let i = 0; i < 7; i++) if (row[i]) c++;
    }
    return c;
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
      const gain = countMatchesForTargetLocal(dice, n);
      if (gain > 0) list.push(n);
    }
    return list;
  }, [diceStatus, targetLocked, dice, fullRows]);

  useEffect(() => {
    if (diceStatus === "choose" && !targetLocked && availableTargets.length === 0) {
      setDiceStatus("stopped");
      setTarget(null);
      setPreviewLocked(Array(6).fill(false));
      setLastGain(0);
    }
  }, [diceStatus, targetLocked, availableTargets.length]);

  const isHost = roomState?.host_player_id && roomState.host_player_id === playerId;
  const gameStarted = isSolo ? true : Boolean(roomState?.started);
  const isMyTurn = isSolo
    ? true
    : gameStarted &&
      String(roomState?.turn_player_id ?? "") === String(playerId ?? "");

  const leader = useMemo(() => {
    if (!playerStates?.length || !players?.length) return null;
    let best = null;
    for (const ps of playerStates) {
      const p = normalizeProgress(ps.progress);
      const w = calcWeightedProgress(p);
      const rows = countCompletedRows(p);
      if (!best || w > best.w || (w === best.w && rows > best.rows)) {
        const player = players.find((pl) => pl.id === ps.player_id);
        best = { id: ps.player_id, name: player?.name ?? "Spelare", w, rows };
      }
    }
    return best;
  }, [playerStates, players]);

  const activePlayer = useMemo(() => {
    if (!roomState?.turn_player_id) return null;
    return players.find((p) => p.id === roomState.turn_player_id) ?? null;
  }, [roomState, players]);

  useEffect(() => {
    if (followActivePlayer && activePlayer?.id) {
      setInspectPlayerId(activePlayer.id);
    }
  }, [followActivePlayer, activePlayer?.id]);

  const canAct = isSolo ? true : gameStarted && isMyTurn;

  const triggerRollAnimation = () => {
    setRolling(true);
    if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    rollTimerRef.current = setTimeout(() => setRolling(false), 450);
  };

  useEffect(() => {
    return () => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!gameStarted) return;
    if (roomState?.turn_player_id) {
      resetTurnState();
    }
  }, [roomState?.turn_player_id, gameStarted]);

  useEffect(() => {
    if (!gameStarted || !isMyTurn) return;
    if (!settings.vibrateOnTurn) return;
    setTurnFlash(true);
    const t = setTimeout(() => setTurnFlash(false), 1500);
    return () => clearTimeout(t);
  }, [gameStarted, isMyTurn, settings.vibrateOnTurn]);

  useEffect(() => {
    if (turnFlash) {
      document.body.classList.add("turn-flash");
    } else {
      document.body.classList.remove("turn-flash");
    }
    return () => document.body.classList.remove("turn-flash");
  }, [turnFlash]);

  const shouldBlinkEdge = canAct && diceStatus === "idle";
  useEffect(() => {
    if (shouldBlinkEdge) {
      document.body.classList.add("turn-waiting");
    } else {
      document.body.classList.remove("turn-waiting");
    }
    return () => document.body.classList.remove("turn-waiting");
  }, [shouldBlinkEdge]);

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
        percent: Math.round(w * 100),
        rows,
      };
    });
  }, [players, playerStates]);

  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const savedCode = localStorage.getItem("scoreboard_room_code");
      const savedRoomId = localStorage.getItem("scoreboard_room_id");
      const savedPlayerId = localStorage.getItem("scoreboard_player_id");

      if (!savedCode || !savedRoomId || !savedPlayerId) return;

      const { data: room, error: roomErr } = await getRoomByCode(savedCode);
      if (roomErr || !room) {
        localStorage.removeItem("scoreboard_room_code");
        localStorage.removeItem("scoreboard_room_id");
        localStorage.removeItem("scoreboard_player_id");
        return;
      }

      const { data: existing } = await getPlayerByDevice(room.id, deviceId);

      let player = existing ?? null;
      if (!player) {
        const { data: p } = await supabase
          .from("players")
          .select("*")
          .eq("id", savedPlayerId)
          .eq("room_id", room.id)
          .maybeSingle();
        player = p ?? null;
      }

      if (!player) {
        localStorage.removeItem("scoreboard_room_code");
        localStorage.removeItem("scoreboard_room_id");
        localStorage.removeItem("scoreboard_player_id");
        return;
      }

      await ensureScore(room.id, player.id);

      if (cancelled) return;

      setRoomCode(savedCode);
      setRoomId(room.id);
      setPlayerId(player.id);
      if (!name && player.name) setName(player.name);
      setStep("room");

      localStorage.setItem("scoreboard_room_code", savedCode);
      localStorage.setItem("scoreboard_room_id", room.id);
      localStorage.setItem("scoreboard_player_id", player.id);
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [deviceId, name]);

  async function loadPlayers(room) {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room)
      .order("joined_at");
    setPlayers(data ?? []);
  }

  async function loadRoomState(room) {
    const { data } = await supabase
      .from("room_state")
      .select("*")
      .eq("room_id", room)
      .maybeSingle();
    setRoomState(data ?? null);
  }

  async function loadPlayerStates(room) {
    const { data } = await supabase
      .from("player_state")
      .select("*")
      .eq("room_id", room);
    setPlayerStates(data ?? []);
  }

  useEffect(() => {
    if (!roomId) return;
    loadPlayers(roomId);
    loadRoomState(roomId);
    loadPlayerStates(roomId);

    const channel = supabase
      .channel(`room:${roomId}:state`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        () => loadPlayers(roomId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_state", filter: `room_id=eq.${roomId}` },
        () => loadRoomState(roomId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_state", filter: `room_id=eq.${roomId}` },
        () => loadPlayerStates(roomId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const canJoin = useMemo(
    () => roomCode.trim().length >= 4 && name.trim().length >= 2,
    [roomCode, name]
  );

  async function createRoom() {
    const code = makeCode(6);
    const { data: room, error } = await createRoomWithCode(code);
    if (error) return alert(error.message);

    setRoomCode(code);
    await joinRoom(code);
  }

  async function joinRoom(codeParam) {
    const code = (codeParam ?? roomCode).trim().toUpperCase();
    const playerName = name.trim();

    const { data: room, error: roomErr } = await getRoomByCode(code);
    if (roomErr || !room) return alert("Rummet hittades inte. Kontrollera koden.");

    let player = null;
    const { data: existing, error: existingErr } = await getPlayerByDevice(room.id, deviceId);

    if (!existingErr && existing) {
      player = existing;
      if (playerName && playerName !== player.name) {
        await supabase.from("players").update({ name: playerName }).eq("id", player.id);
        player = { ...player, name: playerName };
      }
    } else {
      const { data: created, error: playerErr } = await createPlayer(room.id, playerName, deviceId);
      if (playerErr) return alert(playerErr.message);
      player = created;
    }

    const { error: scoreErr } = await ensureScore(room.id, player.id);
    if (scoreErr) return alert(scoreErr.message);

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

    localStorage.setItem("scoreboard_room_code", code);
    localStorage.setItem("scoreboard_room_id", room.id);
    localStorage.setItem("scoreboard_player_id", player.id);

    setRoomCode(code);
    setRoomId(room.id);
    setPlayerId(player.id);
    setStep("room");
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

  async function startGame() {
    if (!roomId || !playerId || !players.length) return;
    const order = shuffleArray(players.map((p) => p.id));
    const first = order[0] ?? playerId;

    const { data: updated } = await supabase
      .from("room_state")
      .upsert(
        {
          room_id: roomId,
          host_player_id: roomState?.host_player_id ?? playerId,
          started: true,
          turn_player_id: first,
          turn_order: order,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" }
      )
      .select("*")
      .single();

    if (updated) setRoomState(updated);
  }

  async function advanceTurn() {
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

    const { data: updated } = await supabase
      .from("room_state")
      .update({
        turn_player_id: next,
        turn_order: activeOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .select("*")
      .single();

    if (updated) setRoomState(updated);
  }

  useEffect(() => {
    if (!roomId || !playerId) return;

    touchPlayer(playerId);
    let heartbeatId = setInterval(() => touchPlayer(playerId), 5 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (heartbeatId) {
          clearInterval(heartbeatId);
          heartbeatId = null;
        }
      } else {
        touchPlayer(playerId);
        if (!heartbeatId) heartbeatId = setInterval(() => touchPlayer(playerId), 5 * 1000);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (heartbeatId) clearInterval(heartbeatId);
    };
  }, [roomId, playerId]);

  useEffect(() => {
    if (!roomId || !playerId) return;

    async function ensureRoomState() {
      const { data: existing } = await supabase
        .from("room_state")
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();

      if (!existing) {
        const { data: created } = await supabase
          .from("room_state")
          .insert([
            {
              room_id: roomId,
              host_player_id: playerId,
              started: false,
              turn_player_id: null,
              turn_order: [],
              updated_at: new Date().toISOString(),
            },
          ])
          .select("*")
          .single();
        setRoomState(created ?? null);
      } else {
        setRoomState(existing);
      }
    }

    ensureRoomState();
  }, [roomId, playerId]);

  function toggleCell(row, idx) {
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

  function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function computeLocks(diceArr, lockedArr, targetVal) {
    const nextLocked = [...lockedArr];
    let gain = 0;

    if (targetVal >= 1 && targetVal <= 6) {
      for (let i = 0; i < diceArr.length; i++) {
        if (!nextLocked[i] && diceArr[i] === targetVal) {
          nextLocked[i] = true;
          gain += 1;
        }
      }
    } else {
      const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      for (let i = 0; i < diceArr.length; i++) {
        if (!nextLocked[i]) buckets[diceArr[i]].push(i);
      }

      for (let v = 1; v <= 6; v++) {
        const c = targetVal - v;
        if (c < 1 || c > 6) continue;
        if (v > c) continue;

        if (v === c) {
          while (buckets[v].length >= 2) {
            const i1 = buckets[v].shift();
            const i2 = buckets[v].shift();
            nextLocked[i1] = true;
            nextLocked[i2] = true;
            gain += 1;
          }
        } else {
          while (buckets[v].length > 0 && buckets[c].length > 0) {
            const i1 = buckets[v].shift();
            const i2 = buckets[c].shift();
            nextLocked[i1] = true;
            nextLocked[i2] = true;
            gain += 1;
          }
        }
      }
    }

    return { nextLocked, gain };
  }

  function countMatchesForTargetLocal(diceArr, targetVal) {
    const { gain } = computeLocks(diceArr, Array(6).fill(false), targetVal);
    return gain;
  }

  function setTargetSafe(value) {
    if (targetLocked) return;
    if (fullRows.has(value)) return;
    setTarget(value);

    if (diceStatus === "choose") {
      const { nextLocked } = computeLocks(dice, locked, value);
      setPreviewLocked(nextLocked);
      return;
    }

    setLocked(Array(6).fill(false));
    setLastGain(0);
    setPreviewLocked(Array(6).fill(false));
  }

  function rerollAll() {
    triggerRollAnimation();
    setDice(Array(6).fill(0).map(() => rollDie()));
    resetTurnState();
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
    if (diceStatus === "stopped" || diceStatus === "all") return;
    if (diceStatus === "idle") {
      triggerRollAnimation();
      const firstDice = Array(6).fill(0).map(() => rollDie());
      setDice(firstDice);
      setLocked(Array(6).fill(false));
      setPreviewLocked(Array(6).fill(false));
      setLastGain(0);
      setDiceStatus("choose");
      setTargetLocked(false);
      return;
    }

    if (!target) return;

    if (diceStatus === "choose") {
      setTargetLocked(true);
    }

    triggerRollAnimation();
    const baseLocked = diceStatus === "choose" ? previewLocked : locked;
    const nextDice = dice.map((d, i) => (baseLocked[i] ? d : rollDie()));
    const { nextLocked, gain } = computeLocks(nextDice, baseLocked, target);

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

    const rowFilled =
      target &&
      (() => {
        const current = (progress?.[target] ?? []).filter(Boolean).length;
        return current + addedCount >= 7;
      })();

    if (nextLocked.every(Boolean) || rowFilled) {
      resetTurnState();
      return;
    }

    if (gain === 0) {
      setDiceStatus("stopped");
    } else {
      setDiceStatus("running");
    }
  }

  function endRound() {
    resetTurnState();
    if (isMyTurn) advanceTurn();
  }

  if (step === "home") {
    return (
      <Container>
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28 }}>12:an</h1>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
              Ditt namn
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
              Rumskod
            </label>
            <Input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="t.ex. A1B2C3"
              style={{ textTransform: "uppercase" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <Button onClick={createRoom}>Skapa rum</Button>
            <Button variant="ghost" onClick={() => joinRoom()} disabled={!canJoin}>
              Joina rum
            </Button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <Button variant="ghost" onClick={() => setStep("solo")}>
              Poängblad
            </Button>
          </div>

          <p style={{ marginTop: 14, color: "var(--muted)" }}>
            Skapa rum → dela koden → alla kan använda samma lobby.
          </p>
          <p style={{ marginTop: 8, color: "var(--muted)" }}>
            Poängblad → spela utan multiplayer.
          </p>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card style={{ padding: 22 }}>
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
            {isSolo && (
              <Button
                variant="ghost"
                style={{ width: "auto", paddingInline: 10, fontSize: 14 }}
                onClick={() => setStep("home")}
              >
                Tillbaka
              </Button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isSolo && isHost && !gameStarted && (
              <Button onClick={startGame} style={{ width: "auto", paddingInline: 10, fontSize: 14 }}>
                Starta spelet
              </Button>
            )}
            {!isSolo && (
              <Button
                variant="ghost"
                style={{ width: "auto", paddingInline: 10, fontSize: 14 }}
                onClick={() => {
                  setInspectPlayerId(activePlayer?.id ?? players[0]?.id ?? null);
                  setShowInspect(true);
                }}
              >
                Inspektera
              </Button>
            )}
            <Button
              variant="ghost"
              style={{ width: "auto", paddingInline: 10, fontSize: 14 }}
              onClick={() => setShowSettings(true)}
            >
              Inställningar
            </Button>
            {!isSolo && (
              <Button variant="danger" style={{ width: "auto", paddingInline: 10, fontSize: 14 }} onClick={handleLeave}>
                Lämna
              </Button>
            )}
          </div>
        </div>


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
            headerRight={null}
            settings={settings}
            showHeader={false}
            showReset={false}
          />
        </div>

        <DiceTray
          show={Boolean(settings.showDice)}
          canAct={canAct}
          dice={dice}
          locked={locked}
          previewLocked={previewLocked}
          isPreview={diceStatus === "choose" && !targetLocked}
          availableTargets={availableTargets}
          fullRows={fullRows}
          rolling={rolling}
          target={target}
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
        />

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
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Ställning</div>
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
                    border: "1px solid var(--border)",
                    background: p.id === playerId ? "rgba(255,255,255,.03)" : "transparent",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {p.name}
                    {p.id === playerId ? " (du)" : ""}
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
      </Card>

      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 100%)" }}>
            <Card style={{ padding: 18, maxHeight: "82vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0 }}>Inställningar</h3>
                <Button variant="ghost" onClick={() => setShowSettings(false)}>
                  Stäng
                </Button>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                <div>
                  <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Box Size</div>
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

                <div>
                  <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Tema</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {themes.map((t) => (
                      <Button
                        key={t.name}
                        variant={
                          settings.bgColor === t.bgColor &&
                          settings.accentColor === t.accentColor &&
                          settings.rowCompleteBg === t.rowCompleteBg &&
                          (settings.buttonIcon ?? "") === (t.buttonIcon ?? "")
                            ? "primary"
                            : "ghost"
                        }
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            bgColor: t.bgColor,
                            accentColor: t.accentColor,
                            checkColor: t.accentColor,
                            rowCompleteBg: t.rowCompleteBg,
                            bgGlow1: t.bgGlow1,
                            bgGlow2: t.bgGlow2,
                            bgPattern: t.bgPattern ?? "none",
                            bgPatternOpacity: t.bgPatternOpacity ?? 0.25,
                            buttonIcon: t.buttonIcon ?? "",
                          }))
                        }
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
                            opacity: 0.9,
                          }}
                        />
                        <div style={{ fontWeight: 800, fontSize: 12 }}>{t.name}</div>
                      </Button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedColors((v) => !v)}
                    style={{
                      marginTop: 10,
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      fontWeight: 800,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {showAdvancedColors ? "Dölj avancerat" : "Visa avancerat"}
                  </button>

                  {showAdvancedColors && (
                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                </div>

                {!isSolo && (
                  <div>
                    <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Lobby</div>
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

                <div>
                  <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Tärningar i appen</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <Button
                      variant={settings.showDice ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, showDice: !s.showDice }))}
                    >
                      {settings.showDice ? "På" : "Av"}
                    </Button>
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Alert</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <Button
                      variant={settings.vibrateOnTurn ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, vibrateOnTurn: !s.vibrateOnTurn }))}
                    >
                      {settings.vibrateOnTurn ? "På" : "Av"}
                    </Button>
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
            background: "rgba(0,0,0,.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(860px, 100%)" }}>
            <Card style={{ padding: 18, maxHeight: "82vh", overflowY: "auto" }}>
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
                    const hasDice = Array.isArray(lastDice) && lastDice.length === 6;
                    const targetLocks =
                      hasDice && lastTarget
                        ? computeLocks(lastDice, Array(6).fill(false), lastTarget).nextLocked
                        : Array(6).fill(false);
                    return (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ fontWeight: 800 }}>
                          {player?.name ?? "Spelare"}
                          {roomState?.turn_player_id === inspectPlayerId ? " (aktiv)" : ""}
                        </div>

                        <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                          Senaste kast: {lastDice.length ? lastDice.join(", ") : "—"}
                          {lastTarget ? ` | Valör: ${lastTarget}` : ""}
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
                              }}
                            >
                              {lastDice.map((d, i) => (
                                <DieFace
                                  key={i}
                                  value={d}
                                  locked={targetLocks[i]}
                                  isPreview={Boolean(lastTarget)}
                                  rolling={false}
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
                          settings={{ ...settings, boxSize: "small" }}
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
  );
}

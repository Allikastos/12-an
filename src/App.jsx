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

function getMonthKeySweden(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function getPreviousMonthKeySweden(date = new Date()) {
  const d = new Date(date.getTime());
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return getMonthKeySweden(d);
}

function ceilToHalf(value) {
  return Math.ceil(value * 2) / 2;
}

const BONUS_ROUNDS_TIER_1 = 37; // ~45% probability threshold (simulation, rounds)
const BONUS_ROUNDS_TIER_2 = 33; // ~20% probability threshold (simulation, rounds)
const UNLOCK_KING_FOR_PREVIEW = false;

function calcWinBonuses(roundsUsed) {
  let bonus = 0;
  if (roundsUsed <= BONUS_ROUNDS_TIER_1) bonus += 1;
  if (roundsUsed <= BONUS_ROUNDS_TIER_2) bonus += 1;
  return bonus;
}

const BG_PATTERNS = {
  none: { image: "none", size: "160px", repeat: "repeat", position: "0 0" },
  moon: { image: "none", size: "160px", repeat: "repeat", position: "0 0" },
  waves: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'120\' viewBox=\'0 0 200 120\'><path d=\'M0 40 Q25 20 50 40 T100 40 T150 40 T200 40\' fill=\'none\' stroke=\'%23a5f3fc\' stroke-opacity=\'0.35\' stroke-width=\'2\'/><path d=\'M0 80 Q25 60 50 80 T100 80 T150 80 T200 80\' fill=\'none\' stroke=\'%2393c5fd\' stroke-opacity=\'0.35\' stroke-width=\'2\'/></svg>")',
    size: "220px",
  },
  forest: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'220\' height=\'200\' viewBox=\'0 0 220 200\'><g fill=\'%2316a34a\' fill-opacity=\'0.28\'><path d=\'M30 170 L55 110 L80 170 Z\'/><path d=\'M90 175 L120 105 L150 175 Z\'/><path d=\'M150 170 L175 120 L200 170 Z\'/></g><g fill=\'%2322c55e\' fill-opacity=\'0.2\'><path d=\'M40 150 L58 120 L76 150 Z\'/><path d=\'M110 155 L125 120 L140 155 Z\'/><path d=\'M165 152 L180 125 L195 152 Z\'/></g><rect x=\'0\' y=\'170\' width=\'220\' height=\'30\' fill=\'%230b2a18\' fill-opacity=\'0.35\'/></svg>")',
    size: "220px",
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
  "blossom-trees": {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'800\' height=\'500\' viewBox=\'0 0 800 500\'><defs><linearGradient id=\'sky\' x1=\'0\' y1=\'0\' x2=\'0\' y2=\'1\'><stop offset=\'0\' stop-color=\'%23fbcfe8\'/><stop offset=\'1\' stop-color=\'%23f9a8d4\'/></linearGradient></defs><rect width=\'800\' height=\'500\' fill=\'url(%23sky)\' fill-opacity=\'0.45\'/><circle cx=\'400\' cy=\'90\' r=\'52\' fill=\'%23fff7ed\' fill-opacity=\'0.65\'/><path d=\'M-40 140 C120 60 220 80 320 120\' fill=\'none\' stroke=\'%238b5e3c\' stroke-opacity=\'0.35\' stroke-width=\'10\'/><path d=\'M-20 220 C140 140 250 160 340 210\' fill=\'none\' stroke=\'%238b5e3c\' stroke-opacity=\'0.3\' stroke-width=\'8\'/><path d=\'M840 160 C680 80 560 90 460 130\' fill=\'none\' stroke=\'%238b5e3c\' stroke-opacity=\'0.35\' stroke-width=\'10\'/><path d=\'M820 240 C660 160 560 180 480 230\' fill=\'none\' stroke=\'%238b5e3c\' stroke-opacity=\'0.3\' stroke-width=\'8\'/><g fill=\'%23f9a8d4\' fill-opacity=\'0.35\'><circle cx=\'120\' cy=\'140\' r=\'6\'/><circle cx=\'160\' cy=\'120\' r=\'5\'/><circle cx=\'210\' cy=\'150\' r=\'5\'/><circle cx=\'580\' cy=\'150\' r=\'6\'/><circle cx=\'630\' cy=\'130\' r=\'5\'/><circle cx=\'680\' cy=\'160\' r=\'5\'/></g><g fill=\'%23f472b6\' fill-opacity=\'0.28\'><circle cx=\'180\' cy=\'220\' r=\'4\'/><circle cx=\'260\' cy=\'240\' r=\'4\'/><circle cx=\'540\' cy=\'230\' r=\'4\'/><circle cx=\'620\' cy=\'250\' r=\'4\'/></g></svg>")',
    size: "cover",
    repeat: "no-repeat",
    position: "center top",
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
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'900\' height=\'1600\' viewBox=\'0 0 900 1600\'><g stroke=\'%23c4b5fd\' stroke-opacity=\'0.25\' stroke-width=\'1\' fill=\'none\'><polyline points=\'120,220 180,205 250,225 320,215 380,235\'/><polyline points=\'520,360 560,330 610,300 670,275 740,255\'/><polyline points=\'240,520 270,500 320,485 360,470\'/><polyline points=\'480,720 520,700 580,675 640,655 700,635\'/><polyline points=\'200,980 250,950 300,930 360,910\'/><polyline points=\'640,980 680,950 720,920\'/><polyline points=\'140,1260 190,1240 240,1220 300,1210\'/><polyline points=\'520,1320 560,1290 610,1260 670,1240\'/></g><g fill=\'%23ddd6fe\' fill-opacity=\'0.7\'><circle cx=\'120\' cy=\'220\' r=\'3\'/><circle cx=\'180\' cy=\'205\' r=\'3\'/><circle cx=\'250\' cy=\'225\' r=\'3\'/><circle cx=\'320\' cy=\'215\' r=\'3\'/><circle cx=\'380\' cy=\'235\' r=\'3\'/><circle cx=\'520\' cy=\'360\' r=\'3\'/><circle cx=\'560\' cy=\'330\' r=\'3\'/><circle cx=\'610\' cy=\'300\' r=\'3\'/><circle cx=\'670\' cy=\'275\' r=\'3\'/><circle cx=\'740\' cy=\'255\' r=\'3\'/><circle cx=\'240\' cy=\'520\' r=\'3\'/><circle cx=\'270\' cy=\'500\' r=\'3\'/><circle cx=\'320\' cy=\'485\' r=\'3\'/><circle cx=\'360\' cy=\'470\' r=\'3\'/><circle cx=\'480\' cy=\'720\' r=\'3\'/><circle cx=\'520\' cy=\'700\' r=\'3\'/><circle cx=\'580\' cy=\'675\' r=\'3\'/><circle cx=\'640\' cy=\'655\' r=\'3\'/><circle cx=\'700\' cy=\'635\' r=\'3\'/><circle cx=\'200\' cy=\'980\' r=\'3\'/><circle cx=\'250\' cy=\'950\' r=\'3\'/><circle cx=\'300\' cy=\'930\' r=\'3\'/><circle cx=\'360\' cy=\'910\' r=\'3\'/><circle cx=\'640\' cy=\'980\' r=\'3\'/><circle cx=\'680\' cy=\'950\' r=\'3\'/><circle cx=\'720\' cy=\'920\' r=\'3\'/><circle cx=\'140\' cy=\'1260\' r=\'3\'/><circle cx=\'190\' cy=\'1240\' r=\'3\'/><circle cx=\'240\' cy=\'1220\' r=\'3\'/><circle cx=\'300\' cy=\'1210\' r=\'3\'/><circle cx=\'520\' cy=\'1320\' r=\'3\'/><circle cx=\'560\' cy=\'1290\' r=\'3\'/><circle cx=\'610\' cy=\'1260\' r=\'3\'/><circle cx=\'670\' cy=\'1240\' r=\'3\'/></g><g fill=\'%23c4b5fd\' fill-opacity=\'0.35\'><circle cx=\'80\' cy=\'120\' r=\'2\'/><circle cx=\'360\' cy=\'120\' r=\'2\'/><circle cx=\'780\' cy=\'140\' r=\'2\'/><circle cx=\'100\' cy=\'620\' r=\'2\'/><circle cx=\'760\' cy=\'660\' r=\'2\'/><circle cx=\'300\' cy=\'1500\' r=\'2\'/><circle cx=\'780\' cy=\'1500\' r=\'2\'/></g></svg>")',
    size: "cover",
    repeat: "no-repeat",
    position: "center top",
  },
  crystals: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\' viewBox=\'0 0 180 180\'><path d=\'M40 140 L60 90 L80 140 Z\' fill=\'%2393c5fd\' fill-opacity=\'0.22\'/><path d=\'M100 140 L120 80 L140 140 Z\' fill=\'%2360a5fa\' fill-opacity=\'0.2\'/></svg>")',
    size: "200px",
  },
  lava: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'240\' height=\'180\' viewBox=\'0 0 240 180\'><path d=\'M0 140 L60 120 L90 150 L140 110 L190 145 L240 120\' fill=\'none\' stroke=\'%23fb923c\' stroke-opacity=\'0.35\' stroke-width=\'10\' stroke-linecap=\'round\'/><path d=\'M-10 100 L50 90 L80 110 L130 80 L170 110 L230 90\' fill=\'none\' stroke=\'%23f97316\' stroke-opacity=\'0.28\' stroke-width=\'8\' stroke-linecap=\'round\'/><circle cx=\'40\' cy=\'40\' r=\'4\' fill=\'%23f97316\' fill-opacity=\'0.35\'/><circle cx=\'120\' cy=\'30\' r=\'3\' fill=\'%23fb923c\' fill-opacity=\'0.35\'/><circle cx=\'200\' cy=\'50\' r=\'3.5\' fill=\'%23ef4444\' fill-opacity=\'0.35\'/></svg>")',
    size: "260px",
  },
  royal: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'240\' height=\'240\' viewBox=\'0 0 240 240\'><defs><linearGradient id=\'g\' x1=\'0\' y1=\'0\' x2=\'1\' y2=\'1\'><stop offset=\'0\' stop-color=\'%23f5d77b\' stop-opacity=\'0.35\'/><stop offset=\'1\' stop-color=\'%23f59e0b\' stop-opacity=\'0.15\'/></linearGradient></defs><g fill=\'none\' stroke=\'url(%23g)\' stroke-width=\'2.6\' stroke-linejoin=\'round\'><path d=\'M26 164 L42 104 L72 142 L96 84 L120 140 L144 100 L170 164 Z\'/><path d=\'M36 170 H160\' stroke-width=\'2.2\' stroke-linecap=\'round\'/></g><g fill=\'%23f5d77b\' fill-opacity=\'0.35\'><circle cx=\'42\' cy=\'104\' r=\'4\'/><circle cx=\'96\' cy=\'84\' r=\'4.6\'/><circle cx=\'144\' cy=\'100\' r=\'4\'/></g><g stroke=\'%23f59e0b\' stroke-opacity=\'0.12\' stroke-width=\'1.4\'><path d=\'M20 40 C50 20 90 20 120 40\'/><path d=\'M120 40 C150 20 190 20 220 40\'/><path d=\'M20 210 C50 190 90 190 120 210\'/><path d=\'M120 210 C150 190 190 190 220 210\'/></g></svg>")',
    size: "240px",
  },
  reggae: {
    image:
      'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'240\' viewBox=\'0 0 300 240\'><g fill=\'%23ef4444\' fill-opacity=\'0.24\'><circle cx=\'40\' cy=\'40\' r=\'3\'/><circle cx=\'90\' cy=\'70\' r=\'5\'/><circle cx=\'150\' cy=\'30\' r=\'3\'/><circle cx=\'230\' cy=\'90\' r=\'4\'/><circle cx=\'260\' cy=\'60\' r=\'3\'/></g><g fill=\'%23facc15\' fill-opacity=\'0.24\'><circle cx=\'60\' cy=\'120\' r=\'3\'/><circle cx=\'130\' cy=\'160\' r=\'5\'/><circle cx=\'200\' cy=\'140\' r=\'3\'/><circle cx=\'250\' cy=\'190\' r=\'4\'/><circle cx=\'30\' cy=\'200\' r=\'3\'/></g><g fill=\'%2322c55e\' fill-opacity=\'0.24\'><circle cx=\'20\' cy=\'180\' r=\'3\'/><circle cx=\'110\' cy=\'210\' r=\'5\'/><circle cx=\'180\' cy=\'200\' r=\'3\'/><circle cx=\'270\' cy=\'40\' r=\'4\'/><circle cx=\'210\' cy=\'30\' r=\'3\'/></g><g stroke-opacity=\'0.12\' stroke-width=\'6\' stroke-linecap=\'round\'><path d=\'M10 20 L120 60\' stroke=\'%23ef4444\'/><path d=\'M140 80 L240 110\' stroke=\'%23facc15\'/><path d=\'M60 160 L180 190\' stroke=\'%2322c55e\'/></g><g stroke-opacity=\'0.08\' stroke-width=\'4\' stroke-linecap=\'round\'><path d=\'M-20 140 L80 170\' stroke=\'%23ef4444\'/><path d=\'M120 10 L220 40\' stroke=\'%23facc15\'/><path d=\'M200 160 L300 190\' stroke=\'%2322c55e\'/></g></svg>")',
    size: "300px",
  },
};



  const THEMES = [
    {
      name: "Standard",
      key: "Standard",
      bgColor: "#0b1020",
      accentColor: "#22c55e",
      rowCompleteBg: "#1f3b2e",
      bgGlow1: "#38bdf8",
      bgGlow2: "#22c55e",
      bgPattern: "none",
      bgPatternOpacity: 0.35,
      diceBg: "#f8fafc",
      dicePip: "#0f172a",
      diceBorder: "rgba(255,255,255,.12)",
      diceLocked: "rgba(34,197,94,.18)",
      dicePipLocked: "var(--accent)",
      btnPrimaryBg: "linear-gradient(180deg, rgba(34,197,94,1), rgba(16,185,129,1))",
      btnPrimaryText: "#07110b",
      btnPrimaryBorder: "rgba(0,0,0,.12)",
      btnPrimaryShadow: "0 10px 24px rgba(16,185,129,.25)",
      buttonIcon: "",
    },
    {
      name: "King of the Month",
      key: "King",
      requiresKing: true,
      bgColor: "#0e0a04",
      accentColor: "#f5d77b",
      rowCompleteBg: "#3b2a12",
      bgGlow1: "#f5d77b",
      bgGlow2: "#f59e0b",
      bgPattern: "royal",
      bgPatternOpacity: 0.4,
      diceBg: "#fff7ed",
      dicePip: "#3b2a12",
      diceBorder: "rgba(245,215,123,.4)",
      diceLocked: "rgba(245,215,123,.28)",
      dicePipLocked: "#f5d77b",
      btnPrimaryBg: "linear-gradient(180deg, #f5d77b 0%, #f59e0b 100%)",
      btnPrimaryText: "#3b2a12",
      btnPrimaryBorder: "rgba(245,215,123,.4)",
      btnPrimaryShadow: "0 10px 24px rgba(245,215,123,.35)",
      buttonIcon: "crown-outline",
    },
    {
      name: "Midnight",
      key: "Midnight",
      bgColor: "#0c0b06",
      accentColor: "#f5c542",
      rowCompleteBg: "#3a2a12",
      bgGlow1: "#f5c542",
      bgGlow2: "#f59e0b",
      bgPattern: "moon",
      bgPatternOpacity: 0.35,
      diceBg: "#fef3c7",
      dicePip: "#3a2a12",
      diceBorder: "rgba(245,197,66,.35)",
      diceLocked: "rgba(245,197,66,.22)",
      dicePipLocked: "#f59e0b",
      buttonIcon: "",
    },
    {
      name: "Ocean",
      key: "Ocean",
      bgColor: "#0b1220",
      accentColor: "#38bdf8",
      rowCompleteBg: "#0f2b3a",
      bgGlow1: "#0ea5e9",
      bgGlow2: "#14b8a6",
      bgPattern: "waves",
      bgPatternOpacity: 0.32,
      diceBg: "#e0f2fe",
      dicePip: "#0b1220",
      diceBorder: "rgba(56,189,248,.35)",
      diceLocked: "rgba(56,189,248,.2)",
      dicePipLocked: "#0ea5e9",
      buttonIcon: "",
    },
    {
      name: "Forest",
      key: "Forest",
      bgColor: "#0b1110",
      accentColor: "#34d399",
      rowCompleteBg: "#123326",
      bgGlow1: "#14532d",
      bgGlow2: "#22c55e",
      bgPattern: "forest",
      bgPatternOpacity: 0.3,
      diceBg: "#ecfdf5",
      dicePip: "#0b1110",
      diceBorder: "rgba(34,197,94,.35)",
      diceLocked: "rgba(34,197,94,.2)",
      dicePipLocked: "#22c55e",
      buttonIcon: "",
    },
    {
      name: "Amber",
      key: "Amber",
      bgColor: "#15100a",
      accentColor: "#f59e0b",
      rowCompleteBg: "#3a250f",
      bgGlow1: "#f97316",
      bgGlow2: "#f59e0b",
      bgPattern: "embers",
      bgPatternOpacity: 0.38,
      diceBg: "#ffedd5",
      dicePip: "#3a250f",
      diceBorder: "rgba(245,158,11,.35)",
      diceLocked: "rgba(245,158,11,.22)",
      dicePipLocked: "#f59e0b",
      buttonIcon: "",
    },
    {
      name: "Rose",
      key: "Rose",
      bgColor: "#160b12",
      accentColor: "#fb7185",
      rowCompleteBg: "#3a1a24",
      bgGlow1: "#fb7185",
      bgGlow2: "#f472b6",
      bgPattern: "petals",
      bgPatternOpacity: 0.34,
      diceBg: "#ffe4e6",
      dicePip: "#3a1a24",
      diceBorder: "rgba(251,113,133,.35)",
      diceLocked: "rgba(251,113,133,.22)",
      dicePipLocked: "#fb7185",
      buttonIcon: "♥",
    },
    {
      name: "Cherry Blossom",
      key: "Cherry Blossom",
      bgColor: "#160c10",
      accentColor: "#f9a8d4",
      rowCompleteBg: "#3a1820",
      bgGlow1: "#f9a8d4",
      bgGlow2: "#f472b6",
      bgPattern: "blossom-trees",
      bgPatternOpacity: 0.4,
      diceBg: "#ffe4e6",
      dicePip: "#3a1820",
      diceBorder: "rgba(249,168,212,.35)",
      diceLocked: "rgba(249,168,212,.22)",
      dicePipLocked: "#f472b6",
      buttonIcon: "✿",
    },
    {
      name: "Reggae",
      key: "Reggae",
      bgColor: "#0b0f0b",
      accentColor: "#22c55e",
      rowCompleteBg: "#1f3b2e",
      bgGlow1: "#ef4444",
      bgGlow2: "#facc15",
      bgPattern: "reggae",
      bgPatternOpacity: 0.35,
      diceBg: "#fef9c3",
      dicePip: "#052e16",
      diceBorder: "rgba(250,204,21,.35)",
      diceLocked: "rgba(34,197,94,.22)",
      dicePipLocked: "#22c55e",
      btnPrimaryBg: "linear-gradient(180deg, rgba(34,197,94,1), rgba(16,185,129,1))",
      btnPrimaryText: "#07110b",
      btnPrimaryBorder: "rgba(0,0,0,.12)",
      btnPrimaryShadow: "0 10px 24px rgba(16,185,129,.25)",
      ringColorMode: "cycle",
      ringColors: ["#ef4444", "#facc15", "#22c55e"],
      buttonIcon: "✶",
    },
    {
      name: "Otis",
      key: "Otis",
      bgColor: "#0b0b0b",
      accentColor: "#f8fafc",
      rowCompleteBg: "#1f1f1f",
      bgGlow1: "#94a3b8",
      bgGlow2: "#f8fafc",
      bgPattern: "paws",
      bgPatternOpacity: 0.28,
      diceBg: "#f8fafc",
      dicePip: "#0f172a",
      diceBorder: "rgba(148,163,184,.35)",
      diceLocked: "rgba(148,163,184,.22)",
      dicePipLocked: "#f8fafc",
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
      key: "Stars",
      bgColor: "#0a0f1a",
      accentColor: "#a78bfa",
      rowCompleteBg: "#1f1b3a",
      bgGlow1: "#7c3aed",
      bgGlow2: "#a78bfa",
      bgPattern: "stars",
      bgPatternOpacity: 0.26,
      diceBg: "#ede9fe",
      dicePip: "#1f1b3a",
      diceBorder: "rgba(167,139,250,.35)",
      diceLocked: "rgba(167,139,250,.22)",
      dicePipLocked: "#a78bfa",
      buttonIcon: "★",
    },
    {
      name: "Ice",
      key: "Ice",
      bgColor: "#0b1218",
      accentColor: "#93c5fd",
      rowCompleteBg: "#16263a",
      bgGlow1: "#93c5fd",
      bgGlow2: "#38bdf8",
      bgPattern: "snow",
      bgPatternOpacity: 0.36,
      diceBg: "#e0f2fe",
      dicePip: "#0b1220",
      diceBorder: "rgba(147,197,253,.35)",
      diceLocked: "rgba(147,197,253,.22)",
      dicePipLocked: "#93c5fd",
      buttonIcon: "snowflake",
    },
    {
      name: "Lava",
      key: "Lava",
      bgColor: "#150b0b",
      accentColor: "#f97316",
      rowCompleteBg: "#3a1a0f",
      bgGlow1: "#f97316",
      bgGlow2: "#ef4444",
      bgPattern: "lava",
      bgPatternOpacity: 0.4,
      diceBg: "#ffedd5",
      dicePip: "#3a1a0f",
      diceBorder: "rgba(249,115,22,.35)",
      diceLocked: "rgba(249,115,22,.22)",
      dicePipLocked: "#f97316",
      buttonIcon: "✹",
    },
  ];

function normalizePatternKey(key) {
  if (!key) return "none";
  if (BG_PATTERNS[key]) return key;
  const legacyMap = {
    blossom: "blossom-trees",
  };
  return BG_PATTERNS[legacyMap[key]] ? legacyMap[key] : "none";
}


export default function App() {
  const [deviceId] = useState(() => getOrCreateDeviceId());

  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [kingHistory, setKingHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isKing, setIsKing] = useState(false);
  const [showKingHistory, setShowKingHistory] = useState(false);

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
            bgPatternOpacity: 0.35,
            diceBg: "#f8fafc",
            dicePip: "#0f172a",
            diceBorder: "rgba(255,255,255,.12)",
            diceLocked: "rgba(34,197,94,.18)",
            dicePipLocked: "var(--accent)",
            btnPrimaryBg: "linear-gradient(180deg, rgba(34,197,94,1), rgba(16,185,129,1))",
            btnPrimaryText: "#07110b",
            btnPrimaryBorder: "rgba(0,0,0,.12)",
            btnPrimaryShadow: "0 10px 24px rgba(16,185,129,.25)",
            ringColorMode: "none",
            ringColors: null,
            themeKey: "Standard",
            buttonIcon: "",
            personalThemes: [],
            personalThemeId: null,
            diceStyle: "classic",
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
        bgPatternOpacity: 0.35,
        diceBg: "#f8fafc",
        dicePip: "#0f172a",
        diceBorder: "rgba(255,255,255,.12)",
        diceLocked: "rgba(34,197,94,.18)",
        dicePipLocked: "var(--accent)",
        btnPrimaryBg: "linear-gradient(180deg, rgba(34,197,94,1), rgba(16,185,129,1))",
        btnPrimaryText: "#07110b",
        btnPrimaryBorder: "rgba(0,0,0,.12)",
        btnPrimaryShadow: "0 10px 24px rgba(16,185,129,.25)",
        ringColorMode: "none",
        ringColors: null,
        themeKey: "Standard",
        buttonIcon: "",
        personalThemes: [],
        personalThemeId: null,
        diceStyle: "classic",
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
    const patternKey = normalizePatternKey(settings.bgPattern);
    if (patternKey !== settings.bgPattern) {
      setSettings((s) => ({ ...s, bgPattern: patternKey }));
      return;
    }
    const pattern = BG_PATTERNS[patternKey] ?? BG_PATTERNS.none;
    root.style.setProperty("--bg-pattern", pattern.image);
    root.style.setProperty("--bg-pattern-size", pattern.size);
    root.style.setProperty("--bg-pattern-repeat", pattern.repeat ?? "repeat");
    root.style.setProperty("--bg-pattern-position", pattern.position ?? "0 0");
    root.style.setProperty("--bg-pattern-opacity", String(settings.bgPatternOpacity ?? 0.25));
    document.body.dataset.theme = patternKey === "none" ? "custom" : patternKey;
    if (settings.diceBg) root.style.setProperty("--dice-bg", settings.diceBg);
    if (settings.dicePip) root.style.setProperty("--dice-pip", settings.dicePip);
    if (settings.diceBorder) root.style.setProperty("--dice-border", settings.diceBorder);
    if (settings.diceLocked) root.style.setProperty("--dice-locked", settings.diceLocked);
    if (settings.dicePipLocked) root.style.setProperty("--dice-pip-locked", settings.dicePipLocked);
    if (settings.btnPrimaryBg) root.style.setProperty("--btn-primary-bg", settings.btnPrimaryBg);
    if (settings.btnPrimaryText) root.style.setProperty("--btn-primary-text", settings.btnPrimaryText);
    if (settings.btnPrimaryBorder) root.style.setProperty("--btn-primary-border", settings.btnPrimaryBorder);
    if (settings.btnPrimaryShadow) root.style.setProperty("--btn-primary-shadow", settings.btnPrimaryShadow);
  }, [settings]);

  useEffect(() => {
    if (!settings.themeKey) {
      setSettings((s) => ({ ...s, themeKey: "Standard" }));
    }
  }, [settings.themeKey]);

  useEffect(() => {
    let active = true;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const sess = data?.session ?? null;
      setSession(sess);
      setUser(sess?.user ?? null);
    }

    initAuth();
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  async function loadProfile(userId) {
    if (!userId) return null;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) {
      setProfile(data);
      if (!name && data.display_name) setName(data.display_name);
      return data;
    }
    const fallbackName = name || authName || "Spelare";
    const { data: created } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: fallbackName })
      .select("*")
      .single();
    if (created) {
      setProfile(created);
      if (!name && created.display_name) setName(created.display_name);
      return created;
    }
    return null;
  }

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    loadProfile(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && roomId && playerId) {
      supabase.from("players").update({ profile_id: user.id }).eq("id", playerId);
    }
  }, [user?.id, roomId, playerId]);

  async function handleSignUp() {
    setAuthError("");
    if (!authEmail || !authPassword || !authName) {
      setAuthError("Fyll i e-post, lösenord och namn.");
      return;
    }
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }
    const uid = data?.user?.id;
    if (uid) {
      await supabase.from("profiles").upsert({ id: uid, display_name: authName });
      setProfile({ id: uid, display_name: authName });
      if (!name) setName(authName);
    }
    setAuthLoading(false);
  }

  async function handleSignIn() {
    setAuthError("");
    if (!authEmail || !authPassword) {
      setAuthError("Fyll i e-post och lösenord.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function loadLeaderboardData(currentUserId) {
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
    const eligibleKing =
      Boolean(currentUserId) &&
      (currentUserId === currentLeaderId || currentUserId === previousMonthWinner?.id);
    setIsKing(eligibleKing);
  }

  async function loadStats(userId) {
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
    let totalRounds = 0;
    let winRoundsCount = 0;

    (myRows ?? []).forEach((r) => {
      if (r.match_id) matches.add(r.match_id);
      if (r.is_winner) {
        wins += 1;
        if (typeof r.rounds === "number") {
          totalRounds += r.rounds;
          winRoundsCount += 1;
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
      matchCount,
      winRatio,
      avgRoundsToWin,
      mostBeaten,
      kingCount,
    });
  }

  async function loadFriendsAndRequests(userId) {
    if (!userId) {
      setFriends([]);
      setFriendRequests({ incoming: [], outgoing: [] });
      return;
    }

    const { data: friendRows } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", userId);
    const friendIds = (friendRows ?? []).map((r) => r.friend_id).filter(Boolean);

    if (friendIds.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", friendIds);
      setFriends(profileRows ?? []);
    } else {
      setFriends([]);
    }

    const { data: incomingRows } = await supabase
      .from("friend_requests")
      .select("id, requester_id, addressee_id, status")
      .eq("addressee_id", userId)
      .eq("status", "pending");
    const incomingIds = (incomingRows ?? []).map((r) => r.requester_id).filter(Boolean);
    let incoming = [];
    if (incomingIds.length) {
      const { data: incomingProfiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", incomingIds);
      const byId = new Map((incomingProfiles ?? []).map((p) => [p.id, p]));
      incoming = (incomingRows ?? []).map((r) => ({
        id: r.id,
        requester: byId.get(r.requester_id),
      }));
    }

    const { data: outgoingRows } = await supabase
      .from("friend_requests")
      .select("id, requester_id, addressee_id, status")
      .eq("requester_id", userId)
      .eq("status", "pending");
    const outgoingIds = (outgoingRows ?? []).map((r) => r.addressee_id).filter(Boolean);
    let outgoing = [];
    if (outgoingIds.length) {
      const { data: outgoingProfiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", outgoingIds);
      const byId = new Map((outgoingProfiles ?? []).map((p) => [p.id, p]));
      outgoing = (outgoingRows ?? []).map((r) => ({
        id: r.id,
        addressee: byId.get(r.addressee_id),
      }));
    }

    setFriendRequests({ incoming, outgoing });
  }

  async function searchProfiles() {
    if (!user?.id) return;
    const q = friendSearch.trim();
    if (!q) {
      setFriendResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", `%${q}%`)
      .limit(20);
    const filtered = (data ?? []).filter((p) => p.id !== user.id);
    setFriendResults(filtered);
  }

  async function sendFriendRequest(targetId) {
    if (!user?.id || !targetId) return;
    await supabase.from("friend_requests").upsert({
      requester_id: user.id,
      addressee_id: targetId,
      status: "pending",
    });
    await loadFriendsAndRequests(user.id);
  }

  async function acceptFriendRequest(requestId, requesterId) {
    if (!user?.id || !requestId || !requesterId) return;
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId);
    await supabase.from("friends").upsert([
      { user_id: user.id, friend_id: requesterId },
      { user_id: requesterId, friend_id: user.id },
    ]);
    await loadFriendsAndRequests(user.id);
  }

  async function declineFriendRequest(requestId) {
    if (!requestId) return;
    await supabase.from("friend_requests").delete().eq("id", requestId);
    if (user?.id) await loadFriendsAndRequests(user.id);
  }

  async function removeFriend(friendId) {
    if (!user?.id || !friendId) return;
    await supabase.from("friends").delete().eq("user_id", user.id).eq("friend_id", friendId);
    await supabase.from("friends").delete().eq("user_id", friendId).eq("friend_id", user.id);
    await loadFriendsAndRequests(user.id);
  }

  async function loadFriendStatsFor(friendId) {
    if (!friendId) return;
    const { data: rows } = await supabase
      .from("match_players")
      .select("match_id, is_winner, rounds")
      .eq("profile_id", friendId);

    const matches = new Set();
    let wins = 0;
    let totalRounds = 0;
    let winRoundsCount = 0;

    (rows ?? []).forEach((r) => {
      if (r.match_id) matches.add(r.match_id);
      if (r.is_winner) {
        wins += 1;
        if (typeof r.rounds === "number") {
          totalRounds += r.rounds;
          winRoundsCount += 1;
        }
      }
    });

    const matchCount = matches.size;
    const winRatio = matchCount ? wins / matchCount : null;
    const avgRoundsToWin = winRoundsCount ? totalRounds / winRoundsCount : null;
    const kingCount = kingHistory.filter((k) => k.winner?.id === friendId).length;

    setFriendStats((prev) => ({
      ...prev,
      [friendId]: { wins, winRatio, avgRoundsToWin, kingCount },
    }));
  }

  async function loadRoomInvites(userId) {
    if (!userId) {
      setRoomInvites([]);
      return;
    }
    const { data: inviteRows } = await supabase
      .from("room_invites")
      .select("id, room_id, sender_profile_id, recipient_profile_id, status, created_at")
      .eq("recipient_profile_id", userId)
      .eq("status", "pending");
    const roomIds = (inviteRows ?? []).map((r) => r.room_id).filter(Boolean);
    const senderIds = (inviteRows ?? []).map((r) => r.sender_profile_id).filter(Boolean);

    const { data: rooms } = roomIds.length
      ? await supabase.from("rooms").select("id, code").in("id", roomIds)
      : { data: [] };
    const { data: senders } = senderIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", senderIds)
      : { data: [] };

    const roomById = new Map((rooms ?? []).map((r) => [r.id, r]));
    const senderById = new Map((senders ?? []).map((s) => [s.id, s]));

    const mapped = (inviteRows ?? []).map((r) => ({
      id: r.id,
      roomId: r.room_id,
      roomCode: roomById.get(r.room_id)?.code ?? "",
      sender: senderById.get(r.sender_profile_id) ?? null,
    }));
    setRoomInvites(mapped);
  }

  async function sendRoomInvite(friendId) {
    if (!user?.id || !roomId || !friendId) return;
    await supabase.from("room_invites").upsert(
      {
        room_id: roomId,
        sender_profile_id: user.id,
        recipient_profile_id: friendId,
        status: "pending",
      },
      { onConflict: "room_id,recipient_profile_id" }
    );
  }

  async function acceptRoomInvite(invite) {
    if (!invite?.id || !invite?.roomCode) return;
    await supabase.from("room_invites").update({ status: "accepted" }).eq("id", invite.id);
    await joinRoom(invite.roomCode);
  }

  async function declineRoomInvite(inviteId) {
    if (!inviteId) return;
    await supabase.from("room_invites").delete().eq("id", inviteId);
    if (user?.id) await loadRoomInvites(user.id);
  }

  useEffect(() => {
    loadLeaderboardData(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setStats(null);
      return;
    }
    loadStats(user.id);
  }, [user?.id, kingHistory.length]);

  useEffect(() => {
    loadFriendsAndRequests(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    loadRoomInvites(user?.id ?? null);
  }, [user?.id]);

  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);
  const [followActivePlayer, setFollowActivePlayer] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [advancedTab, setAdvancedTab] = useState("colors");
  const [personalThemeName, setPersonalThemeName] = useState("");
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [showDiceStyles, setShowDiceStyles] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState([]);
  const [friendStats, setFriendStats] = useState({});
  const [roomInvites, setRoomInvites] = useState([]);
  const lastTurnNotifiedRef = useRef(null);
  const themes = THEMES;
  const themeSnapshot = useMemo(
    () => ({
      boxSize: settings.boxSize,
      rowCompleteBg: settings.rowCompleteBg,
      checkColor: settings.checkColor,
      ringColors: settings.ringColors,
      buttonIcon: settings.buttonIcon,
      diceStyle: settings.diceStyle,
      diceBg: settings.diceBg,
      dicePip: settings.dicePip,
      diceBorder: settings.diceBorder,
      diceLocked: settings.diceLocked,
      dicePipLocked: settings.dicePipLocked,
    }),
    [
      settings.boxSize,
      settings.rowCompleteBg,
      settings.checkColor,
      settings.ringColors,
      settings.buttonIcon,
      settings.diceStyle,
      settings.diceBg,
      settings.dicePip,
      settings.diceBorder,
      settings.diceLocked,
      settings.dicePipLocked,
    ]
  );

  function applyTheme(t) {
    setSettings((s) => ({
      ...s,
      themeKey: t.key ?? t.name,
      bgColor: t.bgColor,
      accentColor: t.accentColor,
      checkColor: t.accentColor,
      rowCompleteBg: t.rowCompleteBg,
      bgGlow1: t.bgGlow1,
      bgGlow2: t.bgGlow2,
      bgPattern: t.bgPattern ?? "none",
      bgPatternOpacity: t.bgPatternOpacity ?? 0.25,
      diceBg: t.diceBg,
      dicePip: t.dicePip,
      diceBorder: t.diceBorder,
      diceLocked: t.diceLocked,
      dicePipLocked: t.dicePipLocked,
      btnPrimaryBg: t.btnPrimaryBg,
      btnPrimaryText: t.btnPrimaryText,
      btnPrimaryBorder: t.btnPrimaryBorder,
      btnPrimaryShadow: t.btnPrimaryShadow,
      ringColorMode: t.ringColorMode ?? "none",
      ringColors: t.ringColors ?? null,
      buttonIcon: t.buttonIcon ?? "",
      personalThemeId: null,
    }));
  }

  function applyPersonalTheme(theme) {
    if (!theme) return;
    setSettings((s) => ({
      ...s,
      ...theme.colors,
      personalThemeId: theme.id,
    }));
  }

  function savePersonalTheme() {
    if (!user) return;
    const nameValue = personalThemeName.trim();
    if (!nameValue) return;
    const id =
      globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `pt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const colors = {
      bgColor: settings.bgColor,
      bgGlow1: settings.bgGlow1,
      bgGlow2: settings.bgGlow2,
      accentColor: settings.accentColor,
      checkColor: settings.checkColor,
      rowCompleteBg: settings.rowCompleteBg,
      bgPattern: settings.bgPattern,
      bgPatternOpacity: settings.bgPatternOpacity,
      diceBg: settings.diceBg,
      dicePip: settings.dicePip,
      diceBorder: settings.diceBorder,
      diceLocked: settings.diceLocked,
      dicePipLocked: settings.dicePipLocked,
      btnPrimaryBg: settings.btnPrimaryBg,
      btnPrimaryText: settings.btnPrimaryText,
      btnPrimaryBorder: settings.btnPrimaryBorder,
      btnPrimaryShadow: settings.btnPrimaryShadow,
      ringColorMode: settings.ringColorMode,
      ringColors: settings.ringColors,
      buttonIcon: settings.buttonIcon,
    };

    setSettings((s) => ({
      ...s,
      personalThemes: [...(s.personalThemes ?? []), { id, name: nameValue, colors }],
      personalThemeId: id,
    }));
    setPersonalThemeName("");
  }

  function deletePersonalTheme(id) {
    setSettings((s) => {
      const next = (s.personalThemes ?? []).filter((t) => t.id !== id);
      return {
        ...s,
        personalThemes: next,
        personalThemeId: s.personalThemeId === id ? null : s.personalThemeId,
      };
    });
  }

  useEffect(() => {
    if (settings.themeKey === "King" && !isKing && !UNLOCK_KING_FOR_PREVIEW) {
      const fallback = themes.find((t) => t.key === "Standard");
      if (fallback) applyTheme(fallback);
    }
  }, [isKing]);

  useEffect(() => {
    if (UNLOCK_KING_FOR_PREVIEW) return;
    if (isKing) return;
    const hasKingOnly =
      settings.themeKey === "King" ||
      settings.bgPattern === "royal" ||
      settings.diceStyle === "king" ||
      settings.buttonIcon === "crown-outline";
    if (hasKingOnly) {
      const fallback = themes.find((t) => t.key === "Standard");
      if (fallback) applyTheme(fallback);
    }
  }, [isKing, settings.themeKey, settings.bgPattern, settings.diceStyle, settings.buttonIcon]);

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
  const [targetLocked, setTargetLocked] = useState(false);
  const [rolling, setRolling] = useState(false);
  const rollTimerRef = useRef(null);
  const [turnFlash, setTurnFlash] = useState(false);

  const isSolo = step === "solo";
  const isHost = roomState?.host_player_id && roomState.host_player_id === playerId;
  const gameStarted = isSolo ? true : Boolean(roomState?.started);
  const isMyTurn = isSolo
    ? true
    : gameStarted &&
      String(roomState?.turn_player_id ?? "") === String(playerId ?? "");

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
    }
  }, [progress, isSolo, gameStarted, hasSignaledWin]);

  useEffect(() => {
    if (!gameStarted) setHasSignaledWin(false);
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

  useEffect(() => {
    if (!settings.turnNotifications) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!isMyTurn || !roomState?.updated_at) return;
    const key = `${roomState.turn_player_id}:${roomState.updated_at}`;
    if (lastTurnNotifiedRef.current === key) return;
    lastTurnNotifiedRef.current = key;
    new Notification("Din tur", { body: "Det är din tur att slå!" });
  }, [isMyTurn, roomState?.updated_at, roomState?.turn_player_id, settings.turnNotifications]);

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

  useEffect(() => {
    if (isSolo || !followActivePlayer) return;
    if (isMyTurn) {
      setShowInspect(false);
      return;
    }
    setShowInspect(true);
  }, [followActivePlayer, isMyTurn, isSolo]);

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

  const canJoin = useMemo(() => {
    const hasName = name.trim().length >= 2 || Boolean(profile?.display_name || authName);
    return roomCode.trim().length >= 4 && hasName;
  }, [roomCode, name, profile?.display_name, authName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedCode = params.get("room");
    if (sharedCode) setRoomCode(sharedCode.toUpperCase());
  }, []);

  async function createRoom() {
    const code = makeCode(6);
    const { data: room, error } = await createRoomWithCode(code);
    if (error) return alert(error.message);

    setRoomCode(code);
    await joinRoom(code);
  }

  async function joinRoom(codeParam) {
    const code = (codeParam ?? roomCode).trim().toUpperCase();
    const playerName = (name.trim() || profile?.display_name || authName || "").trim();

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

  async function startGame() {
    if (!roomId || !playerId || !players.length) return;
    const order = shuffleArray(players.map((p) => p.id));
    const first = order[0] ?? playerId;
    const roundCounts = order.reduce((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {});

    const { data: updated } = await supabase
      .from("room_state")
      .upsert(
        {
          room_id: roomId,
          host_player_id: roomState?.host_player_id ?? playerId,
          started: true,
          turn_player_id: first,
          turn_order: order,
          round_counts: roundCounts,
          finish_triggered: false,
          finish_until_player_id: null,
          finish_winner_ids: [],
          match_id: null,
          finalized_at: null,
          started_at: new Date().toISOString(),
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
              round_counts: {},
              finish_triggered: false,
              finish_until_player_id: null,
              finish_winner_ids: [],
              match_id: null,
              finalized_at: null,
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
    if (settings.showDice) return;
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

  async function incrementRoundCount() {
    if (!roomId || !playerId) return null;
    const base = roomState?.round_counts ?? {};
    const next = { ...base, [playerId]: (base[playerId] ?? 0) + 1 };
    const { data: updated } = await supabase
      .from("room_state")
      .update({
        round_counts: next,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .select("*")
      .single();
    if (updated) setRoomState(updated);
    return next;
  }

  async function signalWin() {
    if (!roomId || !playerId || !roomState?.started) return;
    const order = roomState.turn_order ?? [];
    const finishUntil = roomState.finish_until_player_id ?? order[order.length - 1] ?? playerId;
    const winners = new Set(roomState.finish_winner_ids ?? []);
    winners.add(playerId);

    const { data: updated } = await supabase
      .from("room_state")
      .update({
        finish_triggered: true,
        finish_until_player_id: finishUntil,
        finish_winner_ids: Array.from(winners),
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .select("*")
      .single();
    if (updated) setRoomState(updated);
  }

  async function finalizeMatch(roundCountsOverride) {
    if (!roomId || !roomState || roomState.finalized_at) return;
    const order = roomState.turn_order ?? [];
    if (!order.length) return;
    const winners = roomState.finish_winner_ids ?? [];
    if (!winners.length) return;

    const totalPlayers = order.length;
    const totalPoints = Math.max(1, 1 + 0.5 * Math.max(0, totalPlayers - 2));
    const pointsPerWinner = ceilToHalf(totalPoints / winners.length);
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
      await supabase
        .from("room_state")
        .update({
          started: false,
          turn_player_id: null,
          finalized_at: endedAt,
          updated_at: endedAt,
        })
        .eq("room_id", roomId);
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

    const { data: updated } = await supabase
      .from("room_state")
      .update({
        started: false,
        turn_player_id: null,
        match_id: match.id,
        finalized_at: endedAt,
        updated_at: endedAt,
      })
      .eq("room_id", roomId)
      .select("*")
      .single();
    if (updated) setRoomState(updated);
    await loadLeaderboardData(user?.id ?? null);
    if (user?.id) await loadStats(user.id);
  }

  function endRound() {
    resetTurnState();
    if (!isMyTurn) return;
    (async () => {
      const counts = await incrementRoundCount();
      const isFinalTurn =
        roomState?.finish_triggered && roomState.finish_until_player_id === playerId;
      if (isFinalTurn) {
        await finalizeMatch(counts);
        return;
      }
      advanceTurn();
    })();
  }

  if (step === "home") {
    return (
      <Container>
        <Card style={{ padding: 22, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28 }}>12:an</h1>
          </div>

          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              zIndex: 10,
            }}
          >
            <Button
              variant="ghost"
              onClick={() => setShowAuthPanel((v) => !v)}
              style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12 }}
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
                }}
              >
                👤
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
              <div style={{ fontWeight: 800 }}>King of the Month {getMonthKeySweden()}</div>
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
                <div style={{ fontWeight: 900 }}>{p.points.toFixed(1)}</div>
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
                background: "rgba(0,0,0,.55)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 60,
              }}
            >
              <div onClick={(e) => e.stopPropagation()} style={{ width: "min(860px, 100%)" }}>
                <Card style={{ padding: 18, maxHeight: "82vh", overflow: "auto" }}>
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
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 800 }}>Sök spelare</div>
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

                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 800 }}>Förfrågningar</div>
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

                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 800 }}>Dina vänner</div>
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

                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 800 }}>Inbjudningar till rum</div>
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
            <Card style={{ padding: 18, maxHeight: "82vh", overflow: "auto" }}>
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
                    {(showAllThemes ? themes : themes.slice(0, 6)).map((t) => (
                      <Button
                        key={t.name}
                        variant={settings.themeKey === (t.key ?? t.name) ? "primary" : "ghost"}
                        onClick={() => applyTheme(t)}
                        disabled={Boolean(t.requiresKing && !isKing && !UNLOCK_KING_FOR_PREVIEW)}
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
                        <div style={{ fontWeight: 800, fontSize: 12 }}>
                          {t.name}
                          {t.requiresKing && !isKing && !UNLOCK_KING_FOR_PREVIEW ? " 🔒" : ""}
                        </div>
                      </Button>
                    ))}
                  </div>
                  {themes.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllThemes((v) => !v)}
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
                      {showAllThemes ? "Visa färre" : "Visa fler"}
                    </button>
                  )}

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
                          <option value="royal" disabled={!isKing}>
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

                {!isSolo && (
                  <div>
                    <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>
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
                        {friends.map((f) => (
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
                              variant="ghost"
                              onClick={() => sendRoomInvite(f.id)}
                              style={{ width: "auto", padding: "6px 10px" }}
                            >
                              Bjud in
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
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
                  {settings.showDice && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => setShowDiceStyles((v) => !v)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--muted)",
                          fontWeight: 800,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
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
                            {opt.kingOnly && !isKing ? " 🔒" : ""}
                          </div>
                          <Button
                            variant={settings.diceStyle === opt.key ? "primary" : "ghost"}
                            onClick={() => setSettings((s) => ({ ...s, diceStyle: opt.key }))}
                            disabled={Boolean(opt.kingOnly && !isKing && !UNLOCK_KING_FOR_PREVIEW)}
                            style={{ width: "auto", padding: "8px 10px" }}
                          >
                            Välj
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
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

                <div>
                  <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Notiser</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <Button
                      variant={settings.turnNotifications ? "primary" : "ghost"}
                      onClick={async () => {
                        if (!("Notification" in window)) {
                          alert("Notiser stöds inte i denna webbläsare.");
                          return;
                        }
                        if (Notification.permission !== "granted") {
                          const perm = await Notification.requestPermission();
                          if (perm !== "granted") {
                            setSettings((s) => ({ ...s, turnNotifications: false }));
                            return;
                          }
                        }
                        setSettings((s) => ({ ...s, turnNotifications: !s.turnNotifications }));
                      }}
                    >
                      {settings.turnNotifications ? "På" : "Av"}
                    </Button>
                  </div>
                  <div style={{ color: "var(--muted)", fontWeight: 600, marginTop: 6 }}>
                    Notiser fungerar när appen är öppen.
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
            <Card style={{ padding: 18, maxHeight: "82vh", overflow: "auto" }}>
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

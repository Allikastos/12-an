import { rowWeight } from "../utils/probability";

export function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function sanitizeRoomCode(value) {
  if (!value) return "";
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function getOrCreateDeviceId() {
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

export function emptyProgress() {
  const obj = {};
  for (let r = 1; r <= 12; r++) obj[r] = Array(7).fill(false);
  return obj;
}

export function isProgressWin(progressObj) {
  for (let r = 1; r <= 12; r++) {
    const row = progressObj?.[r];
    if (!row || row.length !== 7 || !row.every(Boolean)) return false;
  }
  return true;
}

export function calcWeightedProgress(progressObj) {
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

export function normalizeProgress(p) {
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

export function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function countCompletedRows(progressObj) {
  let rows = 0;
  for (let r = 1; r <= 12; r++) {
    const row = progressObj?.[r] ?? [];
    if (row.length === 7 && row.every(Boolean)) rows++;
  }
  return rows;
}

export function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export function computeLocks(diceArr, lockedArr, targetVal) {
  const nextLocked = [...lockedArr];
  let gain = 0;
  if (!targetVal) return { nextLocked, gain };

  const remaining = [];
  for (let i = 0; i < diceArr.length; i++) {
    if (!nextLocked[i]) remaining.push({ i, v: diceArr[i] });
  }

  if (targetVal <= 6) {
    for (const { i, v } of remaining) {
      if (v === targetVal) {
        nextLocked[i] = true;
        gain += 1;
      }
    }
  } else {
    const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const item of remaining) buckets[item.v].push(item.i);

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

export function getMonthKeySweden(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function getDateKeySweden(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getStockholmNow() {
  return new Date();
}

export function getStockholmOffset(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = tz.match(/GMT([+-]?)(\d+)(?::(\d+))?/);
  if (!match) return "+00:00";
  const sign = match[1] === "-" ? "-" : "+";
  const hours = String(match[2] ?? "0").padStart(2, "0");
  const mins = String(match[3] ?? "0").padStart(2, "0");
  return `${sign}${hours}:${mins}`;
}

export function getPreviousMonthKeySweden(date = new Date()) {
  const d = new Date(date.getTime());
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return getMonthKeySweden(d);
}

export function getNextBlitzTimes(now = new Date()) {
  const baseNow = now ?? getStockholmNow();
  const dateKey = getDateKeySweden(baseNow);
  const offset = getStockholmOffset(baseNow);
  let start = new Date(`${dateKey}T20:00:00${offset}`);
  if (baseNow.getTime() >= start.getTime()) {
    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const nextKey = getDateKeySweden(nextDay);
    const nextOffset = getStockholmOffset(nextDay);
    start = new Date(`${nextKey}T20:00:00${nextOffset}`);
  }
  const lobby = new Date(`${getDateKeySweden(start)}T19:45:00${getStockholmOffset(start)}`);
  if (typeof window !== "undefined") {
    const qp = new URLSearchParams(window.location.search);
    const testShift = Number(qp.get("blitzTestShiftMin") ?? "");
    if (Number.isFinite(testShift) && testShift !== 0) {
      start.setMinutes(start.getMinutes() + testShift);
      lobby.setMinutes(lobby.getMinutes() + testShift);
    }
  }
  return { start, lobby };
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ceilToHalf(value) {
  return Math.ceil(value * 2) / 2;
}

export const BONUS_ROUNDS_TIER_1 = 37;
export const BONUS_ROUNDS_TIER_2 = 33;
export const UNLOCK_KING_FOR_PREVIEW = false;

export function calcWinBonuses(roundsUsed) {
  let bonus = 0;
  if (roundsUsed <= BONUS_ROUNDS_TIER_1) bonus += 1;
  if (roundsUsed <= BONUS_ROUNDS_TIER_2) bonus += 1;
  return bonus;
}

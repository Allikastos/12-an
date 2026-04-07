export const HARPAN_WINS_KEY = "scoreboard_harpan_wins_v1";
export const HARPAN_WINS_EVENT = "harpan-wins-changed";
export const HARPAN_STATS_KEY = "scoreboard_harpan_stats_v1";

function sanitizeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

function normalizeStats(value) {
  const wins = sanitizeNumber(value?.wins);
  const currentStreak = sanitizeNumber(value?.currentStreak);
  const bestStreak = Math.max(currentStreak, sanitizeNumber(value?.bestStreak));
  return { wins, currentStreak, bestStreak };
}

export function readHarpanWins() {
  try {
    return Number(localStorage.getItem(HARPAN_WINS_KEY) || 0);
  } catch {
    return 0;
  }
}

export function readHarpanStats() {
  try {
    const raw = localStorage.getItem(HARPAN_STATS_KEY);
    if (raw) {
      return normalizeStats(JSON.parse(raw));
    }
  } catch {
    // ignore parse errors
  }
  return normalizeStats({ wins: readHarpanWins(), currentStreak: 0, bestStreak: 0 });
}

function writeHarpanStats(stats) {
  const next = normalizeStats(stats);
  try {
    localStorage.setItem(HARPAN_STATS_KEY, JSON.stringify(next));
    localStorage.setItem(HARPAN_WINS_KEY, String(next.wins));
  } catch {
    // ignore persistence errors
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HARPAN_WINS_EVENT, { detail: next }));
  }
  return next;
}

export function writeHarpanWins(value) {
  const current = readHarpanStats();
  return writeHarpanStats({ ...current, wins: sanitizeNumber(value) });
}

export function recordHarpanWin() {
  const current = readHarpanStats();
  const nextStreak = current.currentStreak + 1;
  return writeHarpanStats({
    wins: current.wins + 1,
    currentStreak: nextStreak,
    bestStreak: Math.max(current.bestStreak, nextStreak),
  });
}

export function resetHarpanStreak() {
  const current = readHarpanStats();
  if (current.currentStreak === 0) return current;
  return writeHarpanStats({ ...current, currentStreak: 0 });
}

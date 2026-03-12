export const HARPAN_WINS_KEY = "scoreboard_harpan_wins_v1";
export const HARPAN_WINS_EVENT = "harpan-wins-changed";

export function readHarpanWins() {
  try {
    return Number(localStorage.getItem(HARPAN_WINS_KEY) || 0);
  } catch {
    return 0;
  }
}

export function writeHarpanWins(value) {
  const next = Math.max(0, Number(value) || 0);
  try {
    localStorage.setItem(HARPAN_WINS_KEY, String(next));
  } catch {
    // ignore persistence errors
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HARPAN_WINS_EVENT, { detail: next }));
  }
  return next;
}

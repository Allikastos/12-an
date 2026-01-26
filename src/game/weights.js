// Vikt per ruta. Högre = svårare = påverkar procent mer.
// 1–6: 1 tärning => p=1/6 => vikt=6
// 7–12: exakt 2 tärningar => p = ways/36 => vikt = 36/ways
export const ROWS = [1,2,3,4,5,6,7,8,9,10,11,12];
export const REQUIRED_PER_ROW = 7;

const twoDiceWays = {
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

export function weightForRow(sum) {
  if (sum >= 1 && sum <= 6) return 6;
  const ways = twoDiceWays[sum] ?? 1;
  return 36 / ways;
}

export function weightedProgress(sheet) {
  // sheet: {1:0..7, ..., 12:0..7}
  let done = 0;
  let total = 0;

  for (const r of ROWS) {
    const w = weightForRow(r);
    const filled = Number(sheet?.[r] ?? 0);
    done += w * Math.min(REQUIRED_PER_ROW, Math.max(0, filled));
    total += w * REQUIRED_PER_ROW;
  }

  return total > 0 ? done / total : 0;
}

export function isWin(sheet) {
  return ROWS.every((r) => Number(sheet?.[r] ?? 0) >= REQUIRED_PER_ROW);
}

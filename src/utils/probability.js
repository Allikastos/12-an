export function rowProbability(row) {
  if (row >= 1 && row <= 6) return 1 / 6;
  const counts = {
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    7: 6,
    8: 5,
    9: 4,
    10: 3,
    11: 2,
    12: 1,
  };
  return (counts[row] ?? 1) / 36;
}

export function rowWeight(row) {
  const p = rowProbability(row);
  const w = 1 / p;
  return Math.min(w, 36);
}

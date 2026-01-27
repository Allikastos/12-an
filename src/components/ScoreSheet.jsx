import { useMemo } from "react";

// 7 kryss per rad (1–12)
const REQUIRED_PER_ROW = 7;
const ROWS = Array.from({ length: 12 }, (_, i) => i + 1);

// Viktning baserat på sannolikhet:
// 1–6: 1 tärning => P = 1/6
// 7–12: 2 tärningar => klassisk 2d6-sannolikhet
function rowProbability(row) {
  if (row >= 1 && row <= 6) return 1 / 6;

  // 2d6
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

function rowWeight(row) {
  // Vikt = 1 / sannolikhet (rarare => tyngre)
  const p = rowProbability(row);
  const w = 1 / p;
  return Math.min(w, 36);
}

function defaultProgress() {
  const obj = {};
  for (const r of ROWS) {
    obj[r] = Array(REQUIRED_PER_ROW).fill(false);
  }
  return obj;
}

export default function ScoreSheet({
  progress,
  onToggle,
  onReset,
  showWin,
  onCloseWin,
  headerRight,
}) {
  const safeProgress = progress ?? defaultProgress();

  const stats = useMemo(() => {
    let done = 0;
    let total = 0;

    let doneWeighted = 0;
    let totalWeighted = 0;

    for (const r of ROWS) {
      const rowArr = safeProgress[r] ?? [];
      const w = rowWeight(r);

      for (let i = 0; i < REQUIRED_PER_ROW; i++) {
        const v = Boolean(rowArr[i]);
        total += 1;
        if (v) done += 1;

        totalWeighted += w;
        if (v) doneWeighted += w;
      }
    }

    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const weightedPercent =
      totalWeighted > 0 ? Math.round((doneWeighted / totalWeighted) * 100) : 0;

    return { done, total, percent, weightedPercent };
  }, [safeProgress]);

  return (
    <div>
      {/* Topprad med progress */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ color: "var(--muted)", fontWeight: 800, letterSpacing: 0.2 }}>
            12:AN – POÄNGBLAD
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{stats.weightedPercent}%</div>
              <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                viktad progress
              </div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{stats.percent}%</div>
              <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                oviktad progress
              </div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {stats.done}/{stats.total}
              </div>
              <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                ikryssade rutor
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{headerRight}</div>
      </div>

      {/* Tabell */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(255,255,255,.02)",
        }}
      >
        {ROWS.map((row) => {
          const rowArr = safeProgress[row] ?? Array(REQUIRED_PER_ROW).fill(false);
          const rowDone = rowArr.every(Boolean);

          return (
            <div
              key={row}
              style={{
                display: "grid",
                gridTemplateColumns: "44px repeat(7, 1fr)",
                gap: 10,
                alignItems: "center",
                padding: "12px 12px",
                borderTop: row === 1 ? "none" : "1px solid var(--border)",
                background: rowDone ? "rgba(34,197,94,.10)" : "transparent",
              }}
            >
              <div style={{ fontWeight: 900, opacity: rowDone ? 1 : 0.9 }}>{row}</div>

              {Array.from({ length: REQUIRED_PER_ROW }, (_, i) => {
                const checked = Boolean(rowArr[i]);
                return (
                  <button
                    key={i}
                    onClick={() => onToggle(row, i)}
                    style={{
                      width: "100%",
                      height: 34,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: checked ? "rgba(34,197,94,.22)" : "rgba(255,255,255,.03)",
                      cursor: "pointer",
                      position: "relative",
                      outline: "none",
                    }}
                    aria-label={`Rad ${row}, ruta ${i + 1}`}
                    type="button"
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        border: checked
                          ? "2px solid rgba(34,197,94,1)"
                          : "2px solid rgba(148,163,184,.7)",
                        background: checked ? "rgba(34,197,94,1)" : "transparent",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Reset */}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onReset}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.08)",
            color: "var(--text)",
            fontWeight: 800,
            cursor: "pointer",
          }}
          type="button"
        >
          Återställ spel
        </button>
      </div>

      {/* Vinst-modal */}
      {showWin && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "grid",
            placeItems: "center",
            padding: 18,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 950 }}>Du vann!</div>
            <div style={{ color: "var(--muted)", marginTop: 6, fontWeight: 700 }}>
              Alla rader (1–12) är klara.
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button
                onClick={onCloseWin}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,.04)",
                  color: "var(--text)",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
                type="button"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { rowWeight } from "../utils/probability";

const REQUIRED_PER_ROW = 7;
const ROWS = Array.from({ length: 12 }, (_, i) => i + 1);

function defaultProgress() {
  const obj = {};
  for (const r of ROWS) obj[r] = Array(REQUIRED_PER_ROW).fill(false);
  return obj;
}

export default function ScoreSheet({
  progress,
  onToggle,
  onReset,
  showWin,
  onCloseWin,
  winVideoSrc,
  headerRight,
  settings,
  showReset = true,
  showHeader = true,
  readOnly = false,
}) {
  const safeProgress = progress ?? defaultProgress();
  const [videoFailed, setVideoFailed] = useState(false);

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
    const weightedPercent = totalWeighted > 0 ? Math.round((doneWeighted / totalWeighted) * 100) : 0;

    return { done, total, percent, weightedPercent };
  }, [safeProgress]);

  const sizeMap = {
    small: "clamp(22px, 6vw, 30px)",
    medium: "clamp(26px, 6.5vw, 36px)",
    large: "clamp(30px, 7.5vw, 44px)",
  };

  const gapMap = {
    small: "clamp(6px, 1.8vw, 8px)",
    medium: "clamp(8px, 2vw, 10px)",
    large: "clamp(10px, 2.4vw, 12px)",
  };

  const boxSize = settings?.boxSize ?? "medium";
  const rowDoneBg = settings?.rowCompleteBg ?? "rgba(34,197,94,.10)";
  const checkColor = settings?.checkColor ?? "var(--accent)";
  const checkIcon = settings?.buttonIcon ?? "";
  const ringColors = Array.isArray(settings?.ringColors) ? settings.ringColors : null;
  const filledRingColor = settings?.filledRingColor ?? checkColor;
  const isSnowflake = checkIcon === "snowflake";
  const isCrownOutline = checkIcon === "crown-outline";
  const isSvgIcon = typeof checkIcon === "string" && checkIcon.startsWith("data:image/svg+xml");
  const crownOutlineData = (color) => {
    const stroke = String(color ?? "#f5d77b").replace("#", "%23");
    return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><path d='M6 46 L12 22 L26 36 L32 16 L38 36 L52 22 L58 46 Z' fill='none' stroke='${stroke}' stroke-width='3.2' stroke-linejoin='round'/><path d='M10 48 H54' stroke='${stroke}' stroke-width='3.2' stroke-linecap='round'/><path d='M16 44 H48' stroke='${stroke}' stroke-width='2.4' stroke-linecap='round' stroke-opacity='0.75'/><circle cx='12' cy='22' r='3' fill='${stroke}'/><circle cx='32' cy='16' r='3.2' fill='${stroke}'/><circle cx='52' cy='22' r='3' fill='${stroke}'/></svg>")`;
  };

  return (
    <div>
      {showHeader && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
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
                  avklarat
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
      )}

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "rgba(255,255,255,.02)",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 0,
            minWidth: "calc(44px + (7 * var(--box)) + (6 * var(--gap)))",
            "--box": sizeMap[boxSize],
            "--gap": gapMap[boxSize],
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
                  gridTemplateColumns: "44px repeat(7, var(--box))",
                  gap: "var(--gap)",
                  alignItems: "center",
                  padding: "12px 12px",
                  borderTop: row === 1 ? "none" : "1px solid var(--border)",
                  background: rowDone ? rowDoneBg : "transparent",
                }}
              >
                <div style={{ fontWeight: 900, opacity: rowDone ? 1 : 0.9 }}>{row}</div>

                {Array.from({ length: REQUIRED_PER_ROW }, (_, i) => {
                  const checked = Boolean(rowArr[i]);
                  const ringColor =
                    ringColors && ringColors.length && checked
                      ? ringColors[(row + i) % ringColors.length]
                      : null;
                  const checkedRing = ringColor ?? filledRingColor;
                  const crownStroke = ringColor ?? (checked ? checkedRing : "rgba(148,163,184,.7)");
                  return (
                    <button
                      key={i}
                      onClick={() => !readOnly && onToggle(row, i)}
                      style={{
                        width: "var(--box)",
                        height: "var(--box)",
                        borderRadius: isCrownOutline ? 10 : 999,
                        border: isCrownOutline
                          ? "none"
                          : `2px solid ${ringColor ?? (checked ? checkedRing : "rgba(148,163,184,.7)")}`,
                        background: "transparent",
                        backgroundImage: isCrownOutline ? crownOutlineData(crownStroke) : "none",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                        backgroundSize: "85% 85%",
                        cursor: readOnly ? "default" : "pointer",
                        position: "relative",
                        outline: "none",
                        boxShadow: isCrownOutline && checked
                          ? "0 0 10px color-mix(in srgb, var(--accent) 40%, transparent)"
                          : "none",
                      }}
                      aria-label={`Rad ${row}, ruta ${i + 1}`}
                      type="button"
                      disabled={readOnly}
                    >
                      {checked && !isCrownOutline && (checkIcon || isSnowflake) && (
                        <span
                          style={{
                            position: "absolute",
                            inset: "10%",
                            display: "block",
                            backgroundImage: isSvgIcon ? `url("${checkIcon}")` : "none",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center",
                            backgroundSize: "contain",
                            fontSize: isSvgIcon ? 0 : "calc(var(--box) * 0.45)",
                            color: checkColor,
                            lineHeight: 1,
                            textAlign: "center",
                          }}
                        >
                          {isSnowflake ? (
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              focusable="false"
                              style={{ width: "100%", height: "100%" }}
                            >
                              <g
                                fill="none"
                                stroke={checkColor}
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="12" y1="3" x2="12" y2="21" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
                                <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
                                <line x1="12" y1="3" x2="9.8" y2="5.2" />
                                <line x1="12" y1="3" x2="14.2" y2="5.2" />
                                <line x1="12" y1="21" x2="9.8" y2="18.8" />
                                <line x1="12" y1="21" x2="14.2" y2="18.8" />
                              </g>
                            </svg>
                          ) : !isSvgIcon ? (
                            checkIcon
                          ) : (
                            ""
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {showReset && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onReset}
            disabled={readOnly}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,.35)",
              background: "rgba(239,68,68,.08)",
              color: "var(--text)",
              fontWeight: 800,
              cursor: readOnly ? "default" : "pointer",
              opacity: readOnly ? 0.5 : 1,
            }}
            type="button"
          >
            Återställ spel
          </button>
        </div>
      )}

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
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, i) => {
              const left = (i * 17) % 100;
              const delay = (i % 7) * 0.18;
              const dur = 3.2 + (i % 5) * 0.35;
              const rot = (i * 37) % 360;
              const hue = (i * 43) % 360;
              return (
                <span
                  key={i}
                  style={{
                    "--x": `${left}%`,
                    "--delay": `${delay}s`,
                    "--dur": `${dur}s`,
                    "--rot": `${rot}deg`,
                    "--hue": hue,
                  }}
                />
              );
            })}
          </div>
          {winVideoSrc ? (
            <div style={{ width: "min(92vw, 920px)" }}>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "min(82vh, 720px)",
                  borderRadius: 26,
                  overflow: "hidden",
                  background: "#0b0b0b",
                  boxShadow: "0 30px 80px rgba(0,0,0,.45)",
                }}
              >
                <video
                  src={winVideoSrc}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  loop={false}
                  preload="auto"
                  disablePictureInPicture
                  controlsList="nodownload noplaybackrate noremoteplayback"
                  onCanPlay={(e) => {
                    const v = e.currentTarget;
                    v.play()
                      .then(() => {
                        // Try to unmute after autoplay (may be blocked by browser policies).
                        v.muted = false;
                        v.play().catch(() => {});
                      })
                      .catch(() => {
                        v.muted = true;
                        v.play().catch(() => {});
                      });
                  }}
                  onError={() => setVideoFailed(true)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    pointerEvents: "none",
                  }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 26,
                    background:
                      "radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.45) 100%)",
                  }}
                />
              </div>
              {videoFailed && (
                <div style={{ color: "var(--muted)", fontWeight: 700, marginTop: 10 }}>
                  Videon kunde inte spelas. Testa att exportera den som MP4 (H.264/AAC).
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
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
          ) : (
            <div
              style={{
                width: "min(520px, 100%)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 18,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 950 }}>Grattis! Du Vann!!</div>

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
          )}
        </div>
      )}
    </div>
  );
}

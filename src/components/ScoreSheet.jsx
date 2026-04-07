import { useEffect, useMemo, useRef, useState } from "react";
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
  const [needsUserPlay, setNeedsUserPlay] = useState(false);
  const winVideoRef = useRef(null);

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
  const checkShape = settings?.checkShape ?? "circle";
  const cellStyle = settings?.cellStyle ?? "ring";
  const isSnowflake = checkIcon === "snowflake";
  const isCrownOutline = checkIcon === "crown-outline";
  const isSuitsCycle = checkIcon === "suits-cycle";
  const isSvgIcon = typeof checkIcon === "string" && checkIcon.startsWith("data:image/svg+xml");

  useEffect(() => {
    if (!showWin || !winVideoSrc) return;
    const v = winVideoRef.current;
    if (!v) return;
    const resetId = setTimeout(() => {
      setVideoFailed(false);
      setNeedsUserPlay(false);
    }, 0);
    v.muted = true;
    v.playsInline = true;
    try {
      v.currentTime = 0;
    } catch {
      // Ignore seek issues on some browsers/devices.
    }
    const tryPlay = () => {
      const res = v.play();
      if (res && typeof res.then === "function") {
        res.then(() => {
          if (!v.paused) setNeedsUserPlay(false);
        }).catch(() => {
          setNeedsUserPlay(true);
        });
      }
    };
    const onCanPlay = () => {
      if (!v.paused) return;
      tryPlay();
    };
    v.addEventListener("loadeddata", onCanPlay);
    v.addEventListener("canplay", onCanPlay);
    tryPlay();
    const checkId = setTimeout(() => {
      if (!v || !v.paused) return;
      setNeedsUserPlay(true);
    }, 1200);
    const retryId = setInterval(() => {
      if (!v || !v.paused) {
        clearInterval(retryId);
        return;
      }
      tryPlay();
    }, 900);
    return () => {
      clearTimeout(resetId);
      v.removeEventListener("loadeddata", onCanPlay);
      v.removeEventListener("canplay", onCanPlay);
      clearTimeout(checkId);
      clearInterval(retryId);
    };
  }, [showWin, winVideoSrc]);

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
                  const shapeStyles = {
                    none: { borderRadius: 0, transform: "none", clipPath: "none" },
                    circle: { borderRadius: 999 },
                    square: { borderRadius: 8 },
                    diamond: { borderRadius: 10, transform: "rotate(45deg)" },
                    hex: { borderRadius: 10, clipPath: "polygon(25% 6%, 75% 6%, 94% 50%, 75% 94%, 25% 94%, 6% 50%)" },
                    skull: { borderRadius: 8 },
                  };
                  const resolvedShape = shapeStyles[checkShape] ?? shapeStyles.circle;
                  const cellStyleMap = {
                    ring: {
                      bg: "transparent",
                      border: `2px solid ${ringColor ?? (checked ? checkedRing : "rgba(148,163,184,.7)")}`,
                      shadow: "none",
                    },
                    solid: {
                      bg: checked
                        ? `color-mix(in srgb, ${checkedRing} 28%, rgba(15,23,42,.45))`
                        : "rgba(15,23,42,.28)",
                      border: `1px solid ${checked ? checkedRing : "rgba(148,163,184,.45)"}`,
                      shadow: checked ? `0 0 0 1px color-mix(in srgb, ${checkedRing} 35%, transparent)` : "none",
                    },
                    glass: {
                      bg: checked
                        ? `linear-gradient(160deg, color-mix(in srgb, ${checkedRing} 24%, rgba(255,255,255,.35)), rgba(15,23,42,.42))`
                        : "linear-gradient(160deg, rgba(255,255,255,.26), rgba(15,23,42,.28))",
                      border: `1px solid ${checked ? "rgba(255,255,255,.7)" : "rgba(148,163,184,.5)"}`,
                      shadow: "inset 0 1px 0 rgba(255,255,255,.38), 0 8px 14px rgba(2,6,23,.26)",
                    },
                    neon: {
                      bg: checked
                        ? `linear-gradient(180deg, rgba(8,10,18,.92), color-mix(in srgb, ${checkedRing} 24%, rgba(8,10,18,.92)))`
                        : "linear-gradient(180deg, rgba(8,10,18,.85), rgba(15,23,42,.8))",
                      border: `1px solid ${checked ? checkedRing : "rgba(148,163,184,.38)"}`,
                      shadow: checked
                        ? `0 0 14px color-mix(in srgb, ${checkedRing} 65%, transparent), inset 0 0 10px rgba(0,0,0,.35)`
                        : "inset 0 0 8px rgba(0,0,0,.25)",
                    },
                    skull: {
                      bg: checked ? "rgba(8,10,18,.92)" : "rgba(8,10,18,.72)",
                      border: "none",
                      shadow: checked
                        ? `0 0 14px color-mix(in srgb, ${checkedRing} 70%, transparent), inset 0 0 10px rgba(0,0,0,.35)`
                        : "inset 0 0 8px rgba(0,0,0,.35)",
                    },
                    "icon-only": {
                      bg: "transparent",
                      border: "none",
                      shadow: "none",
                    },
                  };
                  const cellPreset = cellStyleMap[cellStyle] ?? cellStyleMap.ring;
                  const isSkullShape = checkShape === "skull";
                  const skullGlow = checked ? checkedRing : "#67e8f9";
                  return (
                    <button
                      key={i}
                      onClick={() => !readOnly && onToggle(row, i)}
                      style={{
                        width: "var(--box)",
                        height: "var(--box)",
                        borderRadius: isCrownOutline || isSkullShape ? 0 : resolvedShape.borderRadius,
                        border: isCrownOutline || isSkullShape
                          ? "none"
                          : cellPreset.border,
                        background: isCrownOutline
                          ? "transparent"
                          : isSkullShape
                          ? "transparent"
                          : cellPreset.bg,
                        backgroundImage: "none",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                        backgroundSize: isSkullShape ? "92% 92%" : "85% 85%",
                        cursor: readOnly ? "default" : "pointer",
                        position: "relative",
                        overflow: "visible",
                        outline: "none",
                        transform: isCrownOutline || isSkullShape ? "none" : resolvedShape.transform,
                        clipPath: isCrownOutline || isSkullShape ? "none" : resolvedShape.clipPath,
                        appearance: "none",
                        WebkitAppearance: "none",
                        WebkitTapHighlightColor: "transparent",
                        isolation: "isolate",
                        padding: 0,
                        boxShadow:
                          isCrownOutline || isSkullShape ? "none" : cellPreset.shadow,
                        filter:
                          isCrownOutline && checked
                            ? `drop-shadow(0 0 3px color-mix(in srgb, ${crownStroke} 78%, transparent)) drop-shadow(0 0 9px color-mix(in srgb, ${crownStroke} 52%, transparent))`
                            : "none",
                      }}
                      aria-label={`Rad ${row}, ruta ${i + 1}`}
                      type="button"
                      disabled={readOnly}
                    >
                      {isCrownOutline && (
                        <span
                          style={{
                            position: "absolute",
                            inset: "10%",
                            display: "grid",
                            placeItems: "center",
                            pointerEvents: "none",
                            filter: checked
                              ? `drop-shadow(0 0 3px color-mix(in srgb, ${crownStroke} 82%, transparent)) drop-shadow(0 0 9px color-mix(in srgb, ${crownStroke} 58%, transparent))`
                              : "none",
                          }}
                        >
                          <svg
                            viewBox="0 0 64 64"
                            width="100%"
                            height="100%"
                            aria-hidden="true"
                            focusable="false"
                            style={{ overflow: "visible" }}
                          >
                            <g
                              fill="none"
                              stroke={crownStroke}
                              strokeWidth="3.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeOpacity={checked ? 1 : 0.82}
                            >
                              <path d="M6 46 L12 22 L26 36 L32 16 L38 36 L52 22 L58 46 Z" />
                              <path d="M10 48 H54" />
                              <path d="M16 44 H48" strokeWidth="2.4" strokeOpacity={checked ? 0.82 : 0.68} />
                              <circle cx="12" cy="22" r="3" fill={crownStroke} stroke="none" />
                              <circle cx="32" cy="16" r="3.2" fill={crownStroke} stroke="none" />
                              <circle cx="52" cy="22" r="3" fill={crownStroke} stroke="none" />
                            </g>
                          </svg>
                        </span>
                      )}

                      {isSkullShape && !checked && (
                        <span
                          style={{
                            position: "absolute",
                            inset: "8%",
                            display: "grid",
                            placeItems: "center",
                            pointerEvents: "none",
                          }}
                        >
                          <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">
                            <g
                              fill="none"
                              stroke={skullGlow}
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeOpacity="0.62"
                            >
                              <path d="M32 7 C19.5 7 9 17 9 30 C9 40 15 47 21.5 50.5 V57 H28 V53 H36 V57 H42.5 V50.5 C49 47 55 40 55 30 C55 17 44.5 7 32 7 Z" />
                              <circle cx="24" cy="29" r="4.2" />
                              <circle cx="40" cy="29" r="4.2" />
                              <path d="M30 38 L34 38 L32 42 Z" />
                              <path d="M24 47 H40" />
                            </g>
                          </svg>
                        </span>
                      )}

                      {checked && isSkullShape && (
                        <span
                          style={{
                            position: "absolute",
                            inset: "8%",
                            display: "grid",
                            placeItems: "center",
                            pointerEvents: "none",
                            background: "transparent",
                          }}
                        >
                          <svg
                            viewBox="0 0 64 64"
                            width="100%"
                            height="100%"
                            aria-hidden="true"
                            focusable="false"
                            style={{ background: "transparent", overflow: "visible" }}
                          >
                            <g
                              fill="none"
                              stroke={skullGlow}
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <g
                                strokeWidth="3.4"
                                strokeOpacity="0.24"
                                transform="translate(32 34) scale(1.13) translate(-32 -34)"
                              >
                                <circle cx="32" cy="14.5" r="6" />
                                <circle cx="29.2" cy="13.8" r="1.2" />
                                <circle cx="34.8" cy="13.8" r="1.2" />
                                <path d="M30 17.5 H34" />
                                <path d="M28 22 H36" />
                                <path d="M32 21 L32 36" />
                                <path d="M32 28 L23 32" />
                                <path d="M32 28 L41 32" />
                                <path d="M23 32 L18 25" />
                                <path d="M18 25 L15 30" />
                                <path d="M41 32 L46 25" />
                                <path d="M46 25 L49 30" />
                                <path d="M32 36 L26 46" />
                                <path d="M32 36 L38 46" />
                                <path d="M26 46 L22 56" />
                                <path d="M22 56 L28 56" />
                                <path d="M38 46 L42 56" />
                                <path d="M42 56 L36 56" />
                              </g>
                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="translate"
                                  values="0 0; 0 -1.4; 0 0; 0 1.2; 0 0"
                                  dur="0.72s"
                                  repeatCount="indefinite"
                                />
                                <circle cx="32" cy="14.5" r="6" />
                                <circle cx="29.2" cy="13.8" r="1.2" />
                                <circle cx="34.8" cy="13.8" r="1.2" />
                                <path d="M30 17.5 H34" />
                                <path d="M28 22 H36" />
                              </g>

                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="rotate"
                                  values="-9 32 30; 9 32 30; -9 32 30"
                                  dur="0.7s"
                                  repeatCount="indefinite"
                                />
                                <path d="M32 21 L32 36" />
                                <path d="M32 28 L23 32" />
                                <path d="M32 28 L41 32" />
                              </g>

                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="rotate"
                                  values="24 23 32; -18 23 32; 24 23 32"
                                  dur="0.42s"
                                  repeatCount="indefinite"
                                />
                                <path d="M23 32 L18 25" />
                                <path d="M18 25 L15 30" />
                              </g>
                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="rotate"
                                  values="-24 41 32; 18 41 32; -24 41 32"
                                  dur="0.42s"
                                  repeatCount="indefinite"
                                />
                                <path d="M41 32 L46 25" />
                                <path d="M46 25 L49 30" />
                              </g>

                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="translate"
                                  values="0 0; 0 1.2; 0 0; 0 -1; 0 0"
                                  dur="0.6s"
                                  repeatCount="indefinite"
                                />
                                <path d="M32 36 L26 46" />
                                <path d="M32 36 L38 46" />
                              </g>
                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="rotate"
                                  values="-15 26 46; 15 26 46; -15 26 46"
                                  dur="0.44s"
                                  repeatCount="indefinite"
                                />
                                <path d="M26 46 L22 56" />
                                <path d="M22 56 L28 56" />
                              </g>
                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="rotate"
                                  values="15 38 46; -15 38 46; 15 38 46"
                                  dur="0.44s"
                                  repeatCount="indefinite"
                                />
                                <path d="M38 46 L42 56" />
                                <path d="M42 56 L36 56" />
                              </g>
                            </g>
                          </svg>
                        </span>
                      )}

                      {checked && !isCrownOutline && !isSkullShape && !isSuitsCycle && (checkIcon || isSnowflake) && (
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
                            transform: checkShape === "diamond" ? "rotate(-45deg)" : "none",
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

                      {!isCrownOutline && !isSkullShape && isSuitsCycle && (
                        <span
                          style={{
                            position: "absolute",
                            inset: "4%",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "calc(var(--box) * 0.78)",
                            fontWeight: 900,
                            fontFamily: "\"Fraunces\", \"Space Grotesk\", system-ui, sans-serif",
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                            color: checked
                              ? ["#fda4af", "#c4b5fd", "#fb7185", "#67e8f9"][(row + i) % 4]
                              : "rgba(148,163,184,.5)",
                            textShadow: checked
                              ? "0 1px 0 rgba(255,255,255,.35), 0 0 16px rgba(34,211,238,.22), 0 0 6px rgba(0,0,0,.35)"
                              : "0 1px 0 rgba(255,255,255,.08)",
                            filter: checked ? "drop-shadow(0 0 6px rgba(34,211,238,.2))" : "none",
                            transform: checked ? "scale(1.04)" : "scale(1)",
                            pointerEvents: "none",
                            transition: "transform .16s ease, filter .16s ease, color .16s ease",
                          }}
                        >
                          {["♥", "♠", "♦", "♣"][(row + i) % 4]}
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
          onClick={onCloseWin}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
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
            <div
              style={{ width: "min(92vw, 920px)" }}
              onClick={(e) => {
                e.stopPropagation();
                const v = winVideoRef.current;
                if (!v) return;
                v.muted = false;
                v.play().then(() => {
                  setNeedsUserPlay(false);
                }).catch(() => {
                  v.muted = true;
                  setNeedsUserPlay(true);
                });
              }}
            >
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
                  ref={winVideoRef}
                  src={winVideoSrc}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  loop={false}
                  preload="auto"
                  disablePictureInPicture
                  controlsList="nodownload noplaybackrate noremoteplayback"
                  onError={() => setVideoFailed(true)}
                  onPlaying={() => setNeedsUserPlay(false)}
                  onPause={() => {
                    if (!videoFailed) setNeedsUserPlay(true);
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    pointerEvents: "none",
                  }}
                />
                {needsUserPlay && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      color: "white",
                      fontWeight: 800,
                      textShadow: "0 10px 30px rgba(0,0,0,.6)",
                      background: "rgba(0,0,0,.28)",
                    }}
                  >
                    Tryck för att spela upp
                  </div>
                )}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 26,
                    background:
                      "radial-gradient(150% 150% at 50% 50%, rgba(0,0,0,0) 28%, rgba(0,0,0,.5) 68%, rgba(0,0,0,.92) 100%)," +
                      "linear-gradient(90deg, rgba(0,0,0,.7) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 84%, rgba(0,0,0,.7) 100%)," +
                      "linear-gradient(180deg, rgba(0,0,0,.65) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 84%, rgba(0,0,0,.8) 100%)",
                  }}
                />
              </div>
              {videoFailed && (
                <div style={{ color: "var(--muted)", fontWeight: 700, marginTop: 10 }}>
                  Videon kunde inte spelas. Testa att exportera den som MP4 (H.264/AAC).
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
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

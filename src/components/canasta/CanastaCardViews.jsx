import { rankLabel } from "../../lib/canastaEngine";
import { buildMeldPreviewCards } from "../../lib/canastaPresentation";

const SUIT_SYMBOL = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  joker: "★",
};

const PIP_LAYOUT = {
  1: [[50, 50]],
  2: [[50, 22], [50, 78]],
  3: [[50, 20], [50, 50], [50, 80]],
  4: [[32, 24], [68, 24], [32, 76], [68, 76]],
  5: [[32, 24], [68, 24], [50, 50], [32, 76], [68, 76]],
  6: [[32, 20], [68, 20], [32, 50], [68, 50], [32, 80], [68, 80]],
  7: [[32, 20], [68, 20], [50, 36], [32, 50], [68, 50], [32, 80], [68, 80]],
  8: [[32, 18], [68, 18], [32, 38], [68, 38], [32, 62], [68, 62], [32, 82], [68, 82]],
  9: [[32, 18], [68, 18], [32, 38], [68, 38], [50, 50], [32, 62], [68, 62], [32, 82], [68, 82]],
  10: [[32, 16], [68, 16], [50, 30], [32, 40], [68, 40], [32, 60], [68, 60], [50, 70], [32, 84], [68, 84]],
};

export function TeamMelds({
  title,
  redThreeCount,
  melds,
  orientation = "horizontal",
  compact = false,
  showStackLayers = true,
  noWrap = false,
}) {
  const canastaMelds = melds.filter((m) => (m.cards?.length ?? 0) >= 7);
  const activeMelds = melds.filter((m) => (m.cards?.length ?? 0) < 7);
  const canastaCount = canastaMelds.length;

  function getMeldCardMetrics(meld, totalMelds) {
    if (compact) {
      if ((meld?.cards?.length ?? 0) >= 10 || totalMelds >= 6) return { w: 28, h: 42, step: 7 };
      if ((meld?.cards?.length ?? 0) >= 8 || totalMelds >= 5) return { w: 30, h: 46, step: 8 };
      return { w: 32, h: 50, step: 9 };
    }

    let density = 0;
    if ((meld?.cards?.length ?? 0) > 7) density += 1;
    if ((meld?.cards?.length ?? 0) > 9) density += 1;
    if (totalMelds > 4) density += 1;
    if (totalMelds > 6) density += 1;

    if (density >= 3) return { w: 19, h: 29, step: 5 };
    if (density >= 2) return { w: 21, h: 32, step: 6 };
    if (density >= 1) return { w: 24, h: 36, step: 7 };
    return { w: 27, h: 40, step: 8 };
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(191,219,254,.32)",
        background: "linear-gradient(180deg, rgba(2,6,23,.34), rgba(2,6,23,.22))",
        backdropFilter: "blur(2px)",
        padding: 10,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 12 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
          {redThreeCount > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {Array.from({ length: Math.min(3, redThreeCount) }, (_, idx) => (
                <span
                  key={`${title}-r3-${idx}`}
                  style={{
                    width: 16,
                    height: 22,
                    borderRadius: 4,
                    border: "1px solid rgba(15,23,42,.25)",
                    background: "#fff",
                    color: "#b91c1c",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  3♥
                </span>
              ))}
              {redThreeCount > 3 ? <span style={{ color: "#fecaca", fontWeight: 800, fontSize: 10 }}>+{redThreeCount - 3}</span> : null}
            </div>
          ) : null}
          {canastaCount > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {Array.from({ length: Math.min(3, canastaCount) }, (_, idx) => (
                <span
                  key={`${title}-canasta-${idx}`}
                  style={{
                    width: 16,
                    height: 22,
                    borderRadius: 4,
                    border: "1px solid rgba(15,23,42,.25)",
                    background: "#fff",
                    color: "#0f172a",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  C
                </span>
              ))}
              {canastaCount > 3 ? <span style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 10 }}>+{canastaCount - 3}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: noWrap ? "nowrap" : orientation === "vertical" ? "nowrap" : "wrap",
          flexDirection: orientation === "vertical" ? "column" : "row",
          gap: compact ? 6 : 10,
          alignItems: "flex-start",
          maxHeight: orientation === "vertical" ? (showStackLayers ? (compact ? 140 : 180) : "none") : "none",
          overflowY: orientation === "vertical" ? (showStackLayers ? "auto" : "visible") : "visible",
          overflowX: noWrap ? "visible" : "hidden",
          paddingRight: orientation === "vertical" ? 2 : 0,
        }}
      >
        {activeMelds.map((m, idx) => {
          const preview = buildMeldPreviewCards(title, m).slice(0, 7);
          const metrics = getMeldCardMetrics(m, activeMelds.length);
          const leadCard = preview[0] ?? m.cards?.[0] ?? null;
          const stacked = showStackLayers ? Math.min(3, Math.max(0, (m.cards?.length ?? 0) - 1)) : 0;
          return (
            <div key={`${title}-${m.rank}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
              <div style={{ position: "relative", height: metrics.h + stacked * 2, width: metrics.w + stacked * 3 }}>
                {Array.from({ length: stacked }, (_, cardIdx) => (
                  <div
                    key={`stack-${idx}-${cardIdx}`}
                    style={{
                      position: "absolute",
                      left: (stacked - cardIdx) * 3,
                      top: (stacked - cardIdx) * 2,
                      zIndex: 10 + cardIdx,
                      width: metrics.w,
                      height: metrics.h,
                      borderRadius: 5,
                      overflow: "hidden",
                      boxShadow: "0 3px 7px rgba(2,6,23,.3)",
                      border: "1px solid rgba(148,163,184,.45)",
                      background: "linear-gradient(180deg, #f8fafc, #e2e8f0)",
                    }}
                  />
                ))}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    zIndex: 30,
                    width: metrics.w,
                    height: metrics.h,
                    borderRadius: 5,
                    overflow: "hidden",
                    boxShadow: "0 4px 8px rgba(2,6,23,.35)",
                    border: "1px solid rgba(15,23,42,.28)",
                    background: "#fff",
                  }}
                >
                  <CanastaFace card={leadCard} compact minimal />
                </div>
                {(m.cards?.length ?? 0) > 1 ? (
                  <div
                    style={{
                      position: "absolute",
                      right: -8,
                      bottom: -7,
                      zIndex: 40,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,.5)",
                      background: "rgba(2,6,23,.82)",
                      color: "#e2e8f0",
                      fontWeight: 900,
                      fontSize: 11,
                      display: "grid",
                      placeItems: "center",
                      padding: "0 4px",
                    }}
                  >
                    {m.cards.length}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CanastaFace({ card, compact = false, minimal = false }) {
  if (!card) return <span style={{ color: "var(--muted)", fontWeight: 800 }}>—</span>;
  const suit = card.joker ? "★" : SUIT_SYMBOL[card.suit];
  const rank = card.joker ? "Joker" : rankLabel(card.rank);
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const ink = card.joker ? "#1d4ed8" : isRed ? "#b91c1c" : "#111827";
  const pips = !card.joker && card.rank <= 10 ? PIP_LAYOUT[card.rank] ?? [] : [];
  const isFace = !card.joker && card.rank >= 11;
  const cornerRankSize = compact ? (minimal ? 12 : 11) : 13;
  const cornerSuitSize = compact ? (minimal ? 11 : 10) : 12;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: compact ? 8 : 9,
        border: "1px solid rgba(15,23,42,.28)",
        background: "linear-gradient(180deg, #ffffff, #fbfdff)",
        color: ink,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.8), 0 1px 3px rgba(2,6,23,.22)",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ position: "absolute", left: compact ? 5 : 6, top: compact ? 4 : 5, lineHeight: 1, textAlign: "center" }}>
        <div style={{ fontSize: cornerRankSize, fontWeight: 700 }}>{rank === "Joker" ? "J" : rank}</div>
        <div style={{ fontSize: cornerSuitSize }}>{suit}</div>
      </div>
      <div
        style={{
          position: "absolute",
          right: compact ? 5 : 6,
          bottom: compact ? 4 : 5,
          lineHeight: 1,
          textAlign: "center",
          transform: "rotate(180deg)",
        }}
      >
        <div style={{ fontSize: cornerRankSize, fontWeight: 700 }}>{rank === "Joker" ? "J" : rank}</div>
        <div style={{ fontSize: cornerSuitSize }}>{suit}</div>
      </div>

      {minimal ? null : card.joker ? (
        <div style={{ position: "absolute", inset: "26% 16%", display: "grid", placeItems: "center", gap: 2 }}>
          <div style={{ fontSize: compact ? 16 : 20, lineHeight: 1 }}>★</div>
          <div style={{ fontSize: compact ? 9 : 11, fontWeight: 700, letterSpacing: ".04em" }}>JOKER</div>
        </div>
      ) : isFace ? (
        <div
          style={{
            position: "absolute",
            inset: "24% 22%",
            borderRadius: 6,
            border: "1px solid color-mix(in srgb, currentColor 30%, transparent)",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(180deg, rgba(255,255,255,.86), rgba(241,245,249,.74))",
          }}
        >
          <div style={{ fontSize: compact ? 16 : 21, fontWeight: 700, lineHeight: 1 }}>{rank}</div>
          <div style={{ fontSize: compact ? 12 : 16, lineHeight: 1 }}>{suit}</div>
        </div>
      ) : (
        <div style={{ position: "absolute", inset: compact ? "15% 14%" : "14% 13%" }}>
          {pips.map(([x, y], idx) => (
            <span
              key={`${card.id}-pip-${idx}`}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) ${y > 50 ? "rotate(180deg)" : ""}`,
                fontSize: compact ? 11 : 15,
                lineHeight: 1,
              }}
            >
              {suit}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

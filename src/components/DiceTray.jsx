import { Button } from "../ui/Button";

const DICE_COUNT = 6;

const PIP_MAP = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DieFace({ value, locked, isPreview, rolling, diceStyle = "classic" }) {
  const styleMap = {
    classic: {
      borderRadius: 12,
      background: (locked, isPreview) =>
        locked
          ? isPreview
            ? "linear-gradient(180deg, color-mix(in srgb, var(--dice-locked) 70%, transparent), color-mix(in srgb, var(--dice-locked) 30%, transparent))"
            : "linear-gradient(180deg, color-mix(in srgb, var(--dice-locked) 90%, transparent), color-mix(in srgb, var(--dice-locked) 40%, transparent))"
          : "linear-gradient(180deg, color-mix(in srgb, var(--dice-bg) 85%, transparent), color-mix(in srgb, var(--dice-bg) 40%, transparent))",
      boxShadow: (locked, isPreview) =>
        locked
          ? isPreview
            ? "inset 0 1px 0 rgba(255,255,255,.18), 0 6px 16px rgba(0,0,0,.25)"
            : "inset 0 1px 0 rgba(255,255,255,.25), 0 8px 18px rgba(0,0,0,.35)"
          : "inset 0 1px 0 rgba(255,255,255,.18), 0 10px 22px rgba(0,0,0,.45)",
    },
    glass: {
      borderRadius: 14,
      background: (locked, isPreview) =>
        locked
          ? "linear-gradient(145deg, rgba(255,255,255,.35), rgba(255,255,255,.05)), linear-gradient(180deg, color-mix(in srgb, var(--dice-locked) 60%, transparent), color-mix(in srgb, var(--dice-locked) 20%, transparent))"
          : "linear-gradient(145deg, rgba(255,255,255,.45), rgba(255,255,255,.08)), linear-gradient(180deg, color-mix(in srgb, var(--dice-bg) 60%, transparent), color-mix(in srgb, var(--dice-bg) 20%, transparent))",
      boxShadow: () =>
        "inset 0 1px 0 rgba(255,255,255,.45), inset 0 -12px 18px rgba(0,0,0,.22), 0 12px 26px rgba(0,0,0,.35)",
      border: "1px solid rgba(255,255,255,.35)",
    },
    neon: {
      borderRadius: 10,
      background: (locked, isPreview) =>
        locked
          ? "linear-gradient(180deg, rgba(10,10,14,.8), color-mix(in srgb, var(--dice-locked) 35%, transparent))"
          : "linear-gradient(180deg, rgba(10,10,14,.9), color-mix(in srgb, var(--dice-bg) 35%, transparent))",
      boxShadow: () =>
        "0 0 16px color-mix(in srgb, var(--accent) 75%, transparent), 0 12px 24px rgba(0,0,0,.45)",
      border: "1px solid color-mix(in srgb, var(--accent) 55%, transparent)",
    },
    etched: {
      borderRadius: 8,
      background: (locked, isPreview) =>
        locked
          ? "linear-gradient(180deg, #6b7280, #374151)"
          : "linear-gradient(180deg, #9ca3af, #4b5563)",
      boxShadow: () =>
        "inset 0 2px 6px rgba(0,0,0,.45), inset 0 -2px 4px rgba(255,255,255,.2), 0 10px 20px rgba(0,0,0,.45)",
      border: "1px solid rgba(0,0,0,.5)",
    },
    wood: {
      borderRadius: 10,
      background: () =>
        "repeating-linear-gradient(90deg, #7c4a22 0 6px, #8b572a 6px 12px, #6e3f1c 12px 18px), linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.25))",
      boxShadow: () =>
        "inset 0 1px 0 rgba(255,255,255,.2), inset 0 -4px 8px rgba(0,0,0,.35), 0 10px 20px rgba(0,0,0,.4)",
      border: "1px solid rgba(58,31,12,.7)",
    },
    king: {
      borderRadius: 14,
      background: (locked) =>
        locked
          ? "linear-gradient(160deg, #111827 0%, #0b0f16 60%, #050608 100%)"
          : "linear-gradient(160deg, #111827 0%, #0b0f16 60%, #050608 100%)",
      boxShadow: (locked) =>
        locked
          ? "0 0 18px rgba(245, 215, 123, .55), inset 0 1px 0 rgba(255,255,255,.2), 0 14px 26px rgba(0,0,0,.55)"
          : "inset 0 1px 0 rgba(255,255,255,.12), 0 12px 24px rgba(0,0,0,.6)",
      border: (locked) =>
        locked ? "1px solid rgba(245,215,123,.9)" : "1px solid rgba(245,158,11,.35)",
    },
  };

  const stylePreset = styleMap[diceStyle] ?? styleMap.classic;
  const resolvedBorder =
    typeof stylePreset.border === "function" ? stylePreset.border(locked, isPreview) : stylePreset.border;
  const pipColorMap = {
    classic: "var(--dice-pip)",
    glass: "color-mix(in srgb, var(--dice-pip) 70%, white)",
    neon: "color-mix(in srgb, var(--accent) 85%, white)",
    etched: "#111827",
    wood: "#2d1b0f",
    king: "#f5d77b",
  };
  const pipShadowMap = {
    classic: "inset 0 -1px 0 rgba(0,0,0,.3)",
    glass: "0 0 6px rgba(255,255,255,.35)",
    neon: "0 0 10px color-mix(in srgb, var(--accent) 80%, transparent)",
    etched: "inset 0 1px 0 rgba(255,255,255,.25)",
    wood: "inset 0 1px 0 rgba(255,255,255,.2)",
    king: "0 0 10px rgba(245, 215, 123, .7)",
  };
  const pipColor = pipColorMap[diceStyle] ?? pipColorMap.classic;
  const pipShadow = pipShadowMap[diceStyle] ?? pipShadowMap.classic;
  const pips = PIP_MAP[value] ?? [];
  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: stylePreset.borderRadius,
        border: resolvedBorder ?? "1px solid var(--dice-border)",
        background: stylePreset.background(locked, isPreview),
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 0,
        padding: 6,
        animation: rolling ? "dice-roll 0.45s ease" : "none",
        boxShadow: stylePreset.boxShadow(locked, isPreview),
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            justifySelf: "center",
            alignSelf: "center",
            background: pips.includes(i)
              ? locked
                ? isPreview
                  ? "color-mix(in srgb, var(--dice-pip-locked) 70%, transparent)"
                  : "var(--dice-pip-locked)"
                : pipColor
              : "transparent",
            boxShadow: pips.includes(i) ? pipShadow : "none",
            opacity: pips.includes(i) ? 0.95 : 0,
          }}
        />
      ))}
    </div>
  );
}

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function formatTargetLabel(target) {
  return `${target}`;
}

export default function DiceTray({
  show,
  canAct,
  turnTimeLeft,
  dice,
  locked,
  previewLocked,
  isPreview,
  target,
  availableTargets = [],
  fullRows = new Set(),
  rolling,
  diceStyle = "classic",
  onSetTarget,
  onRoll,
  onReroll,
  onEndRound,
  onInspect,
  showInspect = false,
  lastGain,
  status,
}) {
  if (!show) return null;

  const showTimer = typeof turnTimeLeft === "number" && canAct;
  const timerTone = turnTimeLeft != null && turnTimeLeft <= 5 ? "var(--danger)" : "var(--accent)";
  const statusText =
    (!canAct && "Vänta på din tur.") ||
    (status === "idle" && "Slå för att börja. Välj vad du vill samla på efter första slaget.") ||
    (status === "choose" && "Välj vad du vill samla på.") ||
    (status === "running" && `Nya träffar: ${lastGain}`) ||
    (status === "stopped" && "Inga nya träffar. Avsluta runda.") ||
    (status === "all" && "Alla tärningar låsta. Slå om för ny omgång.");

  return (
    <div
      style={{
        marginTop: 18,
        padding: 14,
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,.02)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Tärningar</div>

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
            Välj vad du vill samla på
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                variant={target === n ? "primary" : "ghost"}
                onClick={() => canAct && onSetTarget(n)}
                disabled={
                  !canAct ||
                  status !== "choose" ||
                  fullRows.has(n) ||
                  !availableTargets.includes(n)
                }
                style={{ padding: "8px 6px", fontWeight: 800 }}
              >
                {formatTargetLabel(n)}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
            Tärningar
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${DICE_COUNT}, minmax(0, 1fr))`,
              gap: 10,
              justifyItems: "center",
            }}
          >
            {dice.map((d, i) => {
              const showLocked = isPreview ? previewLocked?.[i] : locked[i];
              return (
                <DieFace
                  key={i}
                  value={d}
                  locked={showLocked}
                  isPreview={isPreview}
                  rolling={rolling}
                  diceStyle={diceStyle}
                />
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 8,
            alignItems: "stretch",
            gridTemplateColumns: showInspect ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
          }}
        >
          <Button
            onClick={onRoll}
            disabled={
              !canAct ||
              (status === "choose" && !target) ||
              status === "stopped"
            }
            style={{ minWidth: 0, paddingInline: 6, fontSize: 13 }}
          >
            {status === "idle" ? "Slå" : "Slå igen"}
          </Button>
          {showInspect && (
            <Button
              variant="ghost"
              onClick={onInspect}
              style={{ minWidth: 0, paddingInline: 6, fontSize: 13 }}
            >
              Inspektera
            </Button>
          )}
          <Button
            variant="danger"
            onClick={onEndRound}
            disabled={!canAct || status !== "stopped"}
            style={{ minWidth: 0, paddingInline: 6, fontSize: 13 }}
          >
            Avsluta runda
          </Button>
        </div>

        <div
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 220px" }}>{statusText}</div>
          {showTimer && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${timerTone} 55%, transparent)`,
                background: `color-mix(in srgb, ${timerTone} 18%, transparent)`,
                color: timerTone,
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: 0.2,
              }}
            >
              <span>Betänketid</span>
              <span>{turnTimeLeft}s</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

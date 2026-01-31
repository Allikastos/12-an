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
          ? "linear-gradient(160deg, color-mix(in srgb, var(--dice-locked) 70%, transparent), rgba(255,255,255,.08))"
          : "linear-gradient(160deg, rgba(255,255,255,.18), color-mix(in srgb, var(--dice-bg) 75%, transparent))",
      boxShadow: () => "inset 0 1px 0 rgba(255,255,255,.25), 0 12px 24px rgba(0,0,0,.35)",
    },
    neon: {
      borderRadius: 10,
      background: (locked, isPreview) =>
        locked
          ? "linear-gradient(180deg, color-mix(in srgb, var(--dice-locked) 80%, transparent), rgba(0,0,0,.25))"
          : "linear-gradient(180deg, rgba(255,255,255,.12), color-mix(in srgb, var(--dice-bg) 65%, transparent))",
      boxShadow: () =>
        "0 0 12px color-mix(in srgb, var(--dice-pip) 55%, transparent), 0 10px 20px rgba(0,0,0,.35)",
    },
    etched: {
      borderRadius: 8,
      background: (locked, isPreview) =>
        locked
          ? "linear-gradient(180deg, color-mix(in srgb, var(--dice-locked) 85%, transparent), rgba(0,0,0,.2))"
          : "linear-gradient(180deg, rgba(255,255,255,.14), color-mix(in srgb, var(--dice-bg) 70%, transparent))",
      boxShadow: () => "inset 0 0 0 1px rgba(255,255,255,.12), 0 10px 20px rgba(0,0,0,.35)",
    },
    king: {
      borderRadius: 14,
      background: () =>
        "linear-gradient(160deg, #fef3c7 0%, #f59e0b 60%, #b45309 100%)",
      boxShadow: () =>
        "inset 0 1px 0 rgba(255,255,255,.4), 0 12px 24px rgba(0,0,0,.4)",
    },
  };

  const stylePreset = styleMap[diceStyle] ?? styleMap.classic;
  const pips = PIP_MAP[value] ?? [];
  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: stylePreset.borderRadius,
        border: locked
          ? "1px solid var(--dice-border)"
          : "1px solid var(--dice-border)",
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
                : "var(--dice-pip)"
              : "transparent",
            boxShadow: pips.includes(i) ? "inset 0 -1px 0 rgba(0,0,0,.3)" : "none",
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
              status === "stopped" ||
              status === "all"
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

        <div style={{ color: "var(--muted)", fontWeight: 700 }}>
          {!canAct && "Vänta på din tur."}
          {canAct && status === "idle" && "Slå för att börja. Välj vad du vill samla på efter första slaget."}
          {canAct && status === "choose" && "Välj vad du vill samla på."}
          {canAct && status === "running" && `Nya träffar: ${lastGain}`}
          {canAct && status === "stopped" && "Inga nya träffar. Avsluta runda."}
          {canAct && status === "all" && "Alla tärningar låsta. Slå om för ny omgång."}
        </div>
      </div>
    </div>
  );
}

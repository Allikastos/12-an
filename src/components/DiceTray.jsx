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

function DieFace({ value, locked, isPreview }) {
  const pips = PIP_MAP[value] ?? [];
  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: 12,
        border: locked
          ? "1px solid rgba(34,197,94,.35)"
          : "1px solid rgba(255,255,255,.12)",
        background: locked
          ? isPreview
            ? "linear-gradient(180deg, rgba(34,197,94,.10), rgba(34,197,94,.04))"
            : "linear-gradient(180deg, rgba(34,197,94,.18), rgba(34,197,94,.08))"
          : "linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.04))",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 0,
        padding: 6,
        boxShadow: locked
          ? isPreview
            ? "inset 0 1px 0 rgba(255,255,255,.18), 0 6px 16px rgba(0,0,0,.25)"
            : "inset 0 1px 0 rgba(255,255,255,.25), 0 8px 18px rgba(0,0,0,.35)"
          : "inset 0 1px 0 rgba(255,255,255,.18), 0 10px 22px rgba(0,0,0,.45)",
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
                  ? "rgba(34,197,94,.7)"
                  : "var(--accent)"
                : "rgba(15,23,42,.9)"
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
  onSetTarget,
  onRoll,
  onReroll,
  onEndRound,
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
                disabled={!canAct || status !== "choose"}
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
              return <DieFace key={i} value={d} locked={showLocked} isPreview={isPreview} />;
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button
            onClick={onRoll}
            disabled={
              !canAct ||
              (status === "choose" && !target) ||
              status === "stopped" ||
              status === "all"
            }
            style={{ flex: 1 }}
          >
            {status === "idle" ? "Slå" : "Slå igen"}
          </Button>
          <Button
            variant="ghost"
            onClick={onReroll}
            disabled={!canAct || status !== "all"}
            style={{ flex: 1 }}
          >
            Slå om
          </Button>
          <Button
            variant="danger"
            onClick={onEndRound}
            disabled={!canAct || status !== "stopped"}
            style={{ flex: 1 }}
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

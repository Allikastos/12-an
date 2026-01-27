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

function DieFace({ value, locked }) {
  const pips = PIP_MAP[value] ?? [];
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: locked ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.04)",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 0,
        padding: 6,
        boxShadow: locked ? "inset 0 0 0 1px rgba(34,197,94,.35)" : "none",
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            justifySelf: "center",
            alignSelf: "center",
            background: pips.includes(i) ? (locked ? "var(--accent)" : "var(--text)") : "transparent",
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
  return target <= 6 ? `${target}` : `${target} (2 tärn.)`;
}

export default function DiceTray({
  show,
  dice,
  locked,
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
          <div style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>Välj valör</div>
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
                onClick={() => onSetTarget(n)}
                style={{ padding: "8px 6px", fontWeight: 800 }}
              >
                {formatTargetLabel(n)}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
            Tärningar (låsta = valda)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${DICE_COUNT}, minmax(0, 1fr))`,
              gap: 10,
              justifyItems: "center",
            }}
          >
            {dice.map((d, i) => (
              <DieFace key={i} value={d} locked={locked[i]} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button
            onClick={onRoll}
            disabled={
              (status === "choose" && !target) ||
              status === "stopped" ||
              status === "all"
            }
            style={{ flex: 1 }}
          >
            {status === "idle" ? "Slå" : "Slå igen"}
          </Button>
          <Button variant="ghost" onClick={onReroll} style={{ flex: 1 }}>
            Slå om
          </Button>
          <Button
            variant="danger"
            onClick={onEndRound}
            disabled={status !== "stopped"}
            style={{ flex: 1 }}
          >
            Avsluta runda
          </Button>
        </div>

        <div style={{ color: "var(--muted)", fontWeight: 700 }}>
          {status === "idle" && "Slå för att börja. Välj valör efter första slaget."}
          {status === "choose" && "Välj valör och slå igen."}
          {status === "running" && `Nya träffar: ${lastGain}`}
          {status === "stopped" && "Inga nya träffar. Avsluta runda eller slå om."}
          {status === "all" && "Alla tärningar låsta. Slå om för ny omgång."}
        </div>
      </div>
    </div>
  );
}

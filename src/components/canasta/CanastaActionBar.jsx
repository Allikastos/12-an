import { Button } from "../../ui/Button";

export default function CanastaActionBar({ title = "", subtitle = "", actions = [] }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.18)",
        background: "linear-gradient(180deg, rgba(15,23,42,.96), rgba(15,23,42,.88))",
      }}
    >
      {(title || subtitle) && (
        <div style={{ display: "grid", gap: 3 }}>
          {title ? <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: 13 }}>{title}</div> : null}
          {subtitle ? <div style={{ color: "#94a3b8", fontWeight: 600, fontSize: 11, lineHeight: 1.35 }}>{subtitle}</div> : null}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant ?? "ghost"}
            onClick={action.onPress}
            disabled={action.disabled}
            style={{
              width: "auto",
              whiteSpace: "nowrap",
              padding: "9px 12px",
              flex: "0 0 auto",
              opacity: action.disabled ? 0.6 : 1,
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

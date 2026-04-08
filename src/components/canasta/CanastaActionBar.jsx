import { Button } from "../../ui/Button";

export default function CanastaActionBar({ title = "", subtitle = "", actions = [] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        overflowX: "auto",
        padding: "10px 12px",
        borderRadius: 999,
        background: "rgba(8,15,28,.82)",
        boxShadow: "0 14px 30px rgba(2,6,23,.42), inset 0 1px 0 rgba(255,255,255,.05)",
        backdropFilter: "blur(12px)",
      }}
    >
      {(title || subtitle) && (
        <div style={{ display: "grid", gap: 1, minWidth: 0, paddingRight: 2 }}>
          {title ? <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" }}>{title}</div> : null}
          {subtitle ? (
            <div
              style={{
                color: "#94a3b8",
                fontWeight: 600,
                fontSize: 10,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
                maxWidth: 120,
              }}
            >
              {subtitle}
            </div>
          ) : null}
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
              minWidth: 0,
              whiteSpace: "nowrap",
              padding: "9px 12px",
              flex: "0 0 auto",
              borderRadius: 999,
              opacity: action.disabled ? 0.42 : 1,
              boxShadow: action.disabled ? "none" : action.variant === "primary" ? "0 0 18px rgba(34,211,238,.18)" : "none",
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

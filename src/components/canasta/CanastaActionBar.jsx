import { Button } from "../../ui/Button";

export default function CanastaActionBar({ actions = [] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        overflowX: "auto",
        padding: "4px 0",
        borderRadius: 999,
        background: "transparent",
      }}
    >
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
            padding: "8px 12px",
            flex: "0 0 auto",
            borderRadius: 999,
            background: action.disabled ? "rgba(15,23,42,.18)" : "rgba(8,15,28,.54)",
            backdropFilter: "blur(10px)",
            border: "none",
            opacity: action.disabled ? 0.3 : 1,
            boxShadow:
              action.disabled
                ? "none"
                : action.variant === "primary"
                  ? "0 10px 24px rgba(2,6,23,.28), 0 0 16px rgba(34,211,238,.12)"
                  : "0 8px 18px rgba(2,6,23,.22)",
          }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

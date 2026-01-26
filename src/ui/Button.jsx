export function Button({ children, variant = "primary", style, disabled, ...props }) {
  const variants = {
    primary: {
      background: "linear-gradient(180deg, rgba(124,58,237,1), rgba(99,102,241,1))",
      border: "1px solid rgba(255,255,255,.12)",
      color: "white",
    },
    ghost: {
      background: "rgba(255,255,255,.03)",
      border: "1px solid var(--border)",
      color: "var(--text)",
    },
    danger: {
      background: "linear-gradient(180deg, rgba(239,68,68,1), rgba(220,38,38,1))",
      border: "1px solid rgba(255,255,255,.12)",
      color: "white",
    },
  };

  return (
    <button
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontWeight: 700,
        letterSpacing: 0.2,
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

const variants = {
  primary: {
    background: "var(--accent)",
    color: "white",
    border: "1px solid rgba(255,255,255,.10)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  danger: {
    background: "rgba(239,68,68,.14)",
    color: "#fecaca",
    border: "1px solid rgba(239,68,68,.35)",
  },
};

export function Button({
  children,
  variant = "primary",
  disabled,
  onClick,
  type = "button",
  style,
}) {
  const v = variants[variant] ?? variants.primary;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        fontWeight: 900,
        letterSpacing: 0.2,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "transform .06s ease, filter .15s ease",
        outline: "none",
        ...v,
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}

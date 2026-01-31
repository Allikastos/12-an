export function Button({
  children,
  variant = "primary", // primary | ghost | danger
  style,
  ...props
}) {
  const base = {
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 16px",
    borderRadius: 16,
    border: "1px solid transparent",
    fontWeight: 800,
    letterSpacing: 0.2,
    cursor: "pointer",
    userSelect: "none",
    transition: "transform .06s ease, background .15s ease, border-color .15s ease, opacity .15s ease",
  };

  const variants = {
    primary: {
      background: "var(--btn-primary-bg)",
      color: "var(--btn-primary-text)",
      borderColor: "var(--btn-primary-border)",
      boxShadow: "var(--btn-primary-shadow)",
    },
    ghost: {
      background: "rgba(255,255,255,.04)",
      color: "var(--text)",
      borderColor: "var(--border)",
    },
    danger: {
      background: "linear-gradient(180deg, rgba(239,68,68,.9), rgba(220,38,38,.9))",
      color: "white",
      borderColor: "rgba(239,68,68,.35)",
      boxShadow: "0 10px 24px rgba(239,68,68,.2)",
    },
  };

  const disabled = props.disabled;

  return (
    <button
      {...props}
      style={{
        ...base,
        ...(variants[variant] ?? variants.primary),
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "scale(0.99)";
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

import React from "react";

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
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid transparent",
    fontWeight: 800,
    letterSpacing: 0.2,
    cursor: "pointer",
    userSelect: "none",
    transition: "transform .06s ease, background .15s ease, border-color .15s ease, opacity .15s ease",
  };

  const variants = {
    primary: {
      background: "var(--accent)",
      color: "#07110b",
      borderColor: "rgba(0,0,0,.12)",
    },
    ghost: {
      background: "rgba(255,255,255,.03)",
      color: "var(--text)",
      borderColor: "var(--border)",
    },
    danger: {
      background: "rgba(239,68,68,.14)",
      color: "rgba(248,113,113,1)",
      borderColor: "rgba(239,68,68,.25)",
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

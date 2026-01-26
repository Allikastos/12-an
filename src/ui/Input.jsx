export function Input({ style, ...props }) {
  return (
    <input
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,.03)",
        color: "var(--text)",
        outline: "none",
        ...style,
      }}
      {...props}
    />
  );
}
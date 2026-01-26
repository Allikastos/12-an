export function Input({ value, onChange, placeholder, style, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,.03)",
        color: "var(--text)",
        fontSize: 16,
        outline: "none",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)",
        ...style,
      }}
    />
  );
}

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
        border: "1px solid var(--border)",
        borderRadius: 18,
        boxShadow: "var(--glow)",
        width: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

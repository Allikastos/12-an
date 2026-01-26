export function Card({ children, style }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

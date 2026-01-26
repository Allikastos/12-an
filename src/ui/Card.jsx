export function Card({ children, style }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        boxShadow: "0 12px 30px rgba(0,0,0,.35)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Container({ children }) {
  return (
    <div style={{ maxWidth: "var(--max)", margin: "28px auto", padding: "0 var(--pad)" }}>
      {children}
    </div>
  );
}

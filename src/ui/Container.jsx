export function Container({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 16px",
        display: "flex",
        justifyContent: "center",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div style={{ width: "min(720px, 100%)" }}>{children}</div>
    </div>
  );
}

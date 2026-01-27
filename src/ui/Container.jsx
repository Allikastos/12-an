export function Container({ children, style }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "clamp(12px, 3vw, 22px)",
        paddingTop: "calc(clamp(12px, 3vw, 22px) + var(--safe-top, 0px))",
        paddingBottom: "calc(clamp(12px, 3vw, 22px) + var(--safe-bottom, 0px))",
        ...style,
      }}
    >
      <div style={{ width: "min(920px, 100%)" }}>{children}</div>
    </div>
  );
}

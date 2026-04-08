import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";

export default function CanastaExpandedTeamModal({
  expandedTeam,
  setExpandedTeamId,
  buildMeldPreviewCards,
  rankLabel,
  renderCardFace,
}) {
  if (!expandedTeam) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setExpandedTeamId(null)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1180,
        background: "rgba(2,6,23,.64)",
        backdropFilter: "blur(3px)",
        display: "grid",
        placeItems: "center",
        padding: 14,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(860px, 96vw)" }}>
        <Card style={{ maxHeight: "88vh", overflow: "auto", padding: 18, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>{expandedTeam.label} • Stick</h3>
            <Button variant="ghost" onClick={() => setExpandedTeamId(null)} style={{ width: "auto" }}>
              Stäng
            </Button>
          </div>
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 14 }}>
            {expandedTeam.melds.length === 0 && (
              <div style={{ color: "var(--muted)", fontWeight: 700 }}>Inga stick lagda ännu.</div>
            )}
            {expandedTeam.melds.map((m, idx) => {
              const cards = buildMeldPreviewCards(expandedTeam.label, m);
              return (
                <div key={`expanded-meld-${m.rank}-${idx}`} style={{ display: "grid", gap: 6 }}>
                  <div style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 12 }}>
                    {m.rank === 0 ? "Jolle" : `Valör ${rankLabel(m.rank)}`} • {m.cards.length} kort
                  </div>
                  <div
                    style={{
                      position: "relative",
                      width: Math.min(cards.length, 12) * 16 + 68,
                      height: 94,
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.28)",
                      background: "rgba(2,6,23,.34)",
                      padding: 8,
                    }}
                  >
                    {cards.slice(0, 12).map((c, cIdx) => (
                      <div
                        key={`expanded-card-${c.id}-${cIdx}`}
                        style={{
                          position: "absolute",
                          left: 8 + cIdx * 16,
                          top: 8,
                          width: 58,
                          height: 84,
                          borderRadius: 10,
                          overflow: "hidden",
                          border: "1px solid rgba(15,23,42,.35)",
                          boxShadow: "0 6px 14px rgba(2,6,23,.35)",
                          zIndex: 100 - cIdx,
                          background: "#fff",
                        }}
                      >
                        {renderCardFace(c, true)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

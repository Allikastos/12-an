import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";

export default function CanastaMeldPlanModal({
  meldPlan,
  selectedForPlan,
  wildForPlan,
  activePlanCard,
  activePlanTargets,
  planPreview,
  planPreviewCards,
  cardLabel,
  rankLabel,
  setMeldPlan,
  applyPlannedMeld,
  renderCardFace,
}) {
  if (!meldPlan) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setMeldPlan(null)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1190,
        background: "rgba(2,6,23,.64)",
        backdropFilter: "blur(3px)",
        display: "grid",
        placeItems: "center",
        padding: 14,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 96vw)" }}>
        <Card style={{ maxHeight: "88vh", overflow: "auto", padding: 18, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>Strukturera läggning</h3>
            <Button variant="ghost" onClick={() => setMeldPlan(null)} style={{ width: "auto" }}>
              Stäng
            </Button>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
              Markerade kort: {selectedForPlan.length}
            </div>
            <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.28)" }}>
              <div style={{ fontWeight: 800 }}>1) Välj joker/tvåa</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {wildForPlan.map((c) => {
                  const isActive = c.id === meldPlan.activeCardId;
                  const assignedRank = meldPlan.assignments?.[c.id];
                  return (
                    <button
                      key={`plan-card-${c.id}`}
                      type="button"
                      onClick={() =>
                        setMeldPlan((prev) =>
                          prev
                            ? {
                                ...prev,
                                error: "",
                                activeCardId: c.id,
                              }
                            : prev
                        )
                      }
                      style={{
                        width: 54,
                        height: 80,
                        borderRadius: 10,
                        border: isActive ? "2px solid #67e8f9" : "1px solid rgba(148,163,184,.35)",
                        background: "rgba(15,23,42,.38)",
                        padding: 2,
                        cursor: "pointer",
                      }}
                    >
                      {renderCardFace(c, true)}
                      <div style={{ marginTop: 2, color: "#bfdbfe", fontSize: 10, fontWeight: 800 }}>
                        → {Number.isFinite(Number(assignedRank)) ? rankLabel(assignedRank) : "?"}
                      </div>
                    </button>
                  );
                })}
                {wildForPlan.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                    Inga joker/tvåor i denna läggning.
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.28)" }}>
              <div style={{ fontWeight: 800 }}>2) Välj vad joker/tvåa ska räknas som</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {meldPlan.targetRanks.map((rank) => {
                  const disabled = activePlanCard ? !activePlanTargets.includes(rank) : true;
                  const pseudoCard = {
                    id: `plan-stick-${rank}`,
                    suit: rank === 0 ? "joker" : "hearts",
                    rank: rank === 0 ? 0 : rank,
                    joker: rank === 0,
                  };
                  return (
                    <button
                      key={`stick-target-${rank}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!meldPlan.activeCardId) return;
                        setMeldPlan((prev) =>
                          prev
                            ? {
                                ...prev,
                                error: "",
                                assignments: { ...prev.assignments, [prev.activeCardId]: rank },
                              }
                            : prev
                        );
                      }}
                      style={{
                        width: 58,
                        height: 84,
                        borderRadius: 10,
                        border: "1px solid rgba(148,163,184,.35)",
                        background: disabled ? "rgba(15,23,42,.25)" : "rgba(15,23,42,.5)",
                        opacity: disabled ? 0.45 : 1,
                        padding: 2,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {renderCardFace(pseudoCard, true)}
                    </button>
                  );
                })}
              </div>
              {activePlanCard ? (
                <div style={{ color: "#c7d2fe", fontWeight: 700, fontSize: 12 }}>
                  Aktivt kort: {cardLabel(activePlanCard)}
                </div>
              ) : (
                <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Välj ett kort först.</div>
              )}
            </div>
            <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.28)" }}>
              <div style={{ fontWeight: 800 }}>Förhandsvisning</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {planPreviewCards.map((cards, idx) => (
                  <div key={`preview-group-${idx}`} style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 11 }}>Stick {idx + 1}</div>
                    <div
                      style={{
                        position: "relative",
                        width: Math.min(cards.length, 10) * 10 + 42,
                        height: 64,
                        borderRadius: 10,
                        border: "1px solid rgba(148,163,184,.3)",
                        background: "rgba(2,6,23,.32)",
                        padding: 6,
                      }}
                    >
                      {cards.slice(0, 10).map((card, cIdx) => (
                        <div
                          key={`preview-plan-card-${card.id}-${cIdx}`}
                          style={{
                            position: "absolute",
                            left: 6 + cIdx * 10,
                            top: 6,
                            width: 40,
                            height: 58,
                            borderRadius: 7,
                            overflow: "hidden",
                            border: "1px solid rgba(15,23,42,.35)",
                            background: "#fff",
                            zIndex: 100 - cIdx,
                          }}
                        >
                          {renderCardFace(card, true)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {planPreview.groups.length === 0 && (
                <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Ingen gruppering vald ännu.</div>
              )}
              {planPreview.groups.length > 0 && (
                <div style={{ color: "#dbeafe", fontWeight: 700, fontSize: 12 }}>
                  Totalt stick: {planPreview.groups.length}
                </div>
              )}
            </div>
            {(meldPlan.error || planPreview.error) && (
              <div style={{ color: "#fca5a5", fontWeight: 800, fontSize: 12 }}>{meldPlan.error || planPreview.error}</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={applyPlannedMeld}>Lägg enligt plan</Button>
              <Button variant="ghost" onClick={() => setMeldPlan(null)}>
                Avbryt
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

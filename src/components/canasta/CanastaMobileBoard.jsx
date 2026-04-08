function rankToneLabel(meld) {
  if ((meld?.cards?.length ?? 0) < 7) return "";
  const wildCount = (meld.cards ?? []).filter((card) => card.joker || card.rank === 2).length;
  return wildCount > 0 ? "Black" : "Red";
}

function formatMeldTitle(rankLabel, rank) {
  return rank === 0 ? "Joker" : `${rankLabel(rank)}`;
}

function StatusDot({ active = false, done = false }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: active ? "#7dd3fc" : done ? "#86efac" : "rgba(148,163,184,.34)",
        boxShadow: active ? "0 0 10px rgba(125,211,252,.7)" : "none",
      }}
    />
  );
}

function StepIndicator({ phase }) {
  const activeIndex = phase === "draw" ? 0 : phase === "discard" ? 2 : 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <StatusDot active={activeIndex === 0} done={activeIndex > 0} />
      <StatusDot active={activeIndex === 1} done={activeIndex > 1} />
      <StatusDot active={activeIndex === 2} />
    </div>
  );
}

function OpponentLine({ panel }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <span style={{ color: "#f8fafc", fontWeight: 800, fontSize: 13 }}>{panel.label}</span>
        <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 11 }}>{Number(panel.total || 0).toLocaleString("sv-SE")}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: "#64748b", fontWeight: 700, fontSize: 10 }}>{panel.handCount}</span>
        <span
          style={{
            color: panel.opened ? "#86efac" : "#94a3b8",
            fontWeight: 800,
            fontSize: 10,
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          {panel.opened ? "Opened" : "Not opened"}
        </span>
      </div>
    </div>
  );
}

function MeldStrip({ meld, rankLabel, renderCardFace, highlighted = false, small = false, onClick }) {
  const cards = (meld.cards ?? []).slice(0, small ? 5 : 8);
  const cardWidth = small ? 22 : 34;
  const cardHeight = small ? 32 : 48;
  const overlap = small ? 11 : 18;
  const tone = rankToneLabel(meld);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "grid",
        gap: 4,
        justifyItems: "start",
        background: "transparent",
        border: "none",
        padding: 0,
        textAlign: "left",
        cursor: "pointer",
        filter: highlighted ? "drop-shadow(0 0 10px rgba(103,232,249,.24))" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ color: "#f8fafc", fontWeight: 800, fontSize: small ? 10 : 11 }}>{formatMeldTitle(rankLabel, meld.rank)}</span>
        <span style={{ color: "#94a3b8", fontWeight: 800, fontSize: 10 }}>{meld.cards.length}</span>
        {tone ? <span style={{ color: tone === "Black" ? "#cbd5e1" : "#fda4af", fontWeight: 800, fontSize: 9 }}>{tone}</span> : null}
      </div>
      <div style={{ position: "relative", width: Math.max(cardWidth, (cards.length - 1) * overlap + cardWidth), height: cardHeight }}>
        {cards.map((card, index) => (
          <div
            key={`${card.id}-${index}`}
            style={{
              position: "absolute",
              left: index * overlap,
              top: 0,
              width: cardWidth,
              height: cardHeight,
              borderRadius: small ? 8 : 10,
              overflow: "hidden",
              background: "#fffdf8",
              boxShadow: "0 10px 18px rgba(2,6,23,.22)",
            }}
          >
            {renderCardFace(card, small)}
          </div>
        ))}
      </div>
    </button>
  );
}

function Pile({ label, count, card, renderCardFace, onPress, disabled, tone = "neutral" }) {
  const glow =
    tone === "success"
      ? "0 0 0 1px rgba(34,197,94,.22), 0 0 18px rgba(34,197,94,.12)"
      : tone === "warning"
        ? "0 0 0 1px rgba(250,204,21,.24), 0 0 18px rgba(250,204,21,.12)"
        : tone === "info"
          ? "0 0 0 1px rgba(56,189,248,.22), 0 0 18px rgba(56,189,248,.12)"
          : "none";

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      style={{
        display: "grid",
        gap: 6,
        justifyItems: "center",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.34 : 1,
        filter: disabled ? "none" : "drop-shadow(0 14px 26px rgba(2,6,23,.2))",
      }}
    >
      <div
        style={{
          width: 76,
          height: 106,
          borderRadius: 14,
          overflow: "hidden",
          background: card ? "#fffdf8" : "rgba(15,23,42,.7)",
          boxShadow: `${glow}, 0 18px 28px rgba(2,6,23,.24)`,
        }}
      >
        {card ? renderCardFace(card, false) : <div style={{ width: "100%", height: "100%" }} />}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
        <span style={{ color: "#cbd5e1", fontWeight: 800, fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase" }}>{label}</span>
        {count ? <span style={{ color: "#64748b", fontWeight: 700, fontSize: 10 }}>{count}</span> : null}
      </div>
    </button>
  );
}

export default function CanastaMobileBoard({
  game,
  myTeamZone,
  opponentPanels,
  topDiscard,
  canDrawFromStock,
  drawTwo,
  canPickDiscardPile,
  takeDiscardStack,
  tryDiscardSelected,
  canDiscardSelectedCard,
  selectedCards,
  selectedSummary,
  laySelected,
  setExpandedTeamId,
  renderCardFace,
  rankLabel,
}) {
  const safeGame = game ?? { phase: "draw", stock: [], discard: [], discardFrozen: false };
  const myMelds = (myTeamZone?.melds ?? []).filter(Boolean);
  const safeOpponentPanels = (opponentPanels ?? []).filter(Boolean);
  const safeSelectedSummary = selectedSummary ?? {};

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gap: 2 }}>
        {safeOpponentPanels.map((panel) => (
          <OpponentLine key={panel.teamId} panel={panel} />
        ))}
      </div>

      <div
        style={{
          position: "relative",
          minHeight: 360,
          paddingTop: 8,
          backgroundImage: [
            "radial-gradient(130% 100% at 50% 0%, rgba(255,255,255,.025), transparent 58%)",
            "radial-gradient(100% 90% at 50% 44%, rgba(16,185,129,.055), transparent 72%)",
            "linear-gradient(180deg, #0a1617, #071013)",
          ].join(", "),
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.03), inset 0 -50px 70px rgba(2,6,23,.18)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 2, top: 6 }}>
          <StepIndicator phase={safeGame.phase} />
        </div>

        <div style={{ position: "absolute", left: "23%", top: "22%", transform: "translateX(-50%)" }}>
          <Pile
            label="Draw"
            count={safeGame.stock.length}
            onPress={drawTwo}
            disabled={!canDrawFromStock}
            renderCardFace={renderCardFace}
            tone={canDrawFromStock ? "info" : "neutral"}
          />
        </div>

        <div style={{ position: "absolute", right: "23%", top: "22%", transform: "translateX(50%)" }}>
          <Pile
            label="Discard"
            count={safeGame.discard.length}
            onPress={safeGame.phase === "draw" ? takeDiscardStack : tryDiscardSelected}
            disabled={safeGame.phase === "draw" ? !canPickDiscardPile : !canDiscardSelectedCard}
            card={topDiscard}
            renderCardFace={renderCardFace}
            tone={safeGame.discardFrozen ? "warning" : canPickDiscardPile ? "success" : "neutral"}
          />
        </div>

        {myMelds.length ? (
          <div
            style={{
              position: "absolute",
              left: 8,
              right: 8,
              top: "44%",
              display: "grid",
              gap: 12,
              justifyItems: "center",
            }}
          >
            {myMelds.map((meld, index) => (
              <MeldStrip
                key={`my-meld-${meld.rank}-${index}`}
                meld={meld}
                rankLabel={rankLabel}
                renderCardFace={renderCardFace}
                highlighted={safeSelectedSummary.targetExistingRank === meld.rank && safeSelectedSummary.canLayNow}
                onClick={() => {
                  if (safeSelectedSummary.targetExistingRank === meld.rank && safeSelectedSummary.canLayNow) laySelected?.();
                  else setExpandedTeamId(myTeamZone?.teamId ?? null);
                }}
              />
            ))}
          </div>
        ) : null}

        {selectedCards.length > 0 ? (
          <div
            style={{
              position: "absolute",
              right: 8,
              top: 8,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <div style={{ color: "#7dd3fc", fontWeight: 800, fontSize: 10 }}>{selectedCards.length}</div>
            {safeSelectedSummary.intentLabel ? (
              <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 10 }}>{safeSelectedSummary.intentLabel}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

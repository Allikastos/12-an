function rankToneLabel(meld) {
  if ((meld?.cards?.length ?? 0) < 7) return "";
  const wildCount = (meld.cards ?? []).filter((card) => card.joker || card.rank === 2).length;
  return wildCount > 0 ? "Svart canasta" : "Röd canasta";
}

function formatMeldTitle(rankLabel, rank) {
  return rank === 0 ? "Jolle" : `${rankLabel(rank)}`;
}

function MiniMeldChip({ meld, rankLabel }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 8px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,.16)",
        background: "rgba(15,23,42,.62)",
      }}
    >
      <span style={{ color: "#f8fafc", fontWeight: 800, fontSize: 11 }}>{formatMeldTitle(rankLabel, meld.rank)}</span>
      <span style={{ color: "#94a3b8", fontWeight: 800, fontSize: 10 }}>{meld.cards.length}</span>
      {rankToneLabel(meld) ? (
        <span style={{ color: meld.cards.filter((card) => card.joker || card.rank === 2).length > 0 ? "#cbd5e1" : "#fca5a5", fontWeight: 800, fontSize: 10 }}>
          {rankToneLabel(meld)}
        </span>
      ) : null}
    </div>
  );
}

function OpponentPanel({ panel }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "6px 2px 2px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: 14, whiteSpace: "nowrap" }}>{panel.label}</div>
          <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12 }}>{Number(panel.total || 0).toLocaleString("sv-SE")}</div>
        </div>
        <div
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            background: panel.opened ? "rgba(34,197,94,.12)" : "rgba(148,163,184,.1)",
            color: panel.opened ? "#86efac" : "#cbd5e1",
            fontSize: 10,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {panel.opened ? "Opened" : "Not opened"}
        </div>
      </div>
      {panel.melds?.length ? (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {panel.melds.map((meld, index) => (
            <MiniMeldChip key={`${panel.teamId}-meld-${meld.rank}-${index}`} meld={meld} rankLabel={panel.rankLabel} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#64748b", fontWeight: 700, fontSize: 11 }}>{panel.playerNames}</div>
          <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 11 }}>{panel.handCount} cards</div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, tone = "neutral", compact = false }) {
  const toneMap = {
    neutral: { bg: "rgba(148,163,184,.12)", color: "#cbd5e1", border: "rgba(148,163,184,.16)" },
    success: { bg: "rgba(34,197,94,.14)", color: "#86efac", border: "rgba(34,197,94,.2)" },
    warning: { bg: "rgba(250,204,21,.14)", color: "#fde68a", border: "rgba(250,204,21,.2)" },
    danger: { bg: "rgba(248,113,113,.14)", color: "#fca5a5", border: "rgba(248,113,113,.2)" },
    info: { bg: "rgba(56,189,248,.14)", color: "#7dd3fc", border: "rgba(56,189,248,.2)" },
  };
  const colors = toneMap[tone] ?? toneMap.neutral;
  return (
    <div
      style={{
        padding: compact ? "4px 8px" : "6px 10px",
        borderRadius: 999,
        background: colors.bg,
        color: colors.color,
        fontWeight: 800,
        fontSize: compact ? 10 : 11,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

function StepIndicator({ phase }) {
  const steps = [
    { key: "draw", label: "Draw" },
    { key: "meld", label: "Meld" },
    { key: "discard", label: "Discard" },
  ];
  const activeIndex = phase === "draw" ? 0 : phase === "discard" ? 1 : 2;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {steps.map((step, index) => {
        const active = index === activeIndex;
        const done = index < activeIndex;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: active ? "#7dd3fc" : done ? "#86efac" : "rgba(148,163,184,.38)",
                boxShadow: active ? "0 0 12px rgba(125,211,252,.75)" : "none",
              }}
            />
            <span style={{ color: active ? "#e2e8f0" : "#64748b", fontSize: 11, fontWeight: active ? 800 : 700 }}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MyMeldCard({ meld, rankLabel, highlighted, onPress }) {
  const tone = rankToneLabel(meld);
  const wildCount = (meld.cards ?? []).filter((card) => card.joker || card.rank === 2).length;
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        display: "grid",
        gap: 6,
        textAlign: "left",
        padding: 12,
        minWidth: 140,
        borderRadius: 16,
        border: highlighted ? "1px solid rgba(103,232,249,.55)" : "1px solid rgba(148,163,184,.16)",
        background: highlighted
          ? "linear-gradient(180deg, rgba(8,47,73,.96), rgba(15,23,42,.92))"
          : "linear-gradient(180deg, rgba(15,23,42,.94), rgba(2,6,23,.88))",
        boxShadow: highlighted ? "0 0 0 1px rgba(34,211,238,.2), 0 10px 24px rgba(2,6,23,.35)" : "none",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: 14 }}>{formatMeldTitle(rankLabel, meld.rank)}</div>
        <div style={{ color: "#94a3b8", fontWeight: 800, fontSize: 12 }}>{meld.cards.length} kort</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <StatusPill label={`${wildCount} wild`} tone={wildCount > 0 ? "warning" : "neutral"} />
        {tone ? <StatusPill label={tone} tone={wildCount > 0 ? "neutral" : "danger"} /> : null}
      </div>
    </button>
  );
}

function PileButton({ title, subtitle, onPress, disabled, card, renderCardFace, accentTone = "neutral", badge }) {
  const accentMap = {
    neutral: "rgba(148,163,184,.18)",
    success: "rgba(34,197,94,.3)",
    warning: "rgba(250,204,21,.28)",
    info: "rgba(56,189,248,.28)",
  };
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      style={{
        display: "grid",
        gap: 8,
        justifyItems: "center",
        alignContent: "center",
        minHeight: 156,
        padding: 12,
        borderRadius: 22,
        background: "linear-gradient(180deg, rgba(15,23,42,.68), rgba(2,6,23,.36))",
        boxShadow: disabled
          ? "inset 0 1px 0 rgba(255,255,255,.02)"
          : `inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px ${accentMap[accentTone] ?? accentMap.neutral}, 0 16px 32px rgba(2,6,23,.24)`,
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase" }}>{title}</div>
      <div
        style={{
          width: 74,
          height: 104,
          borderRadius: 14,
          overflow: "hidden",
          background: card ? "#fffdf8" : "rgba(15,23,42,.75)",
          boxShadow: "0 14px 24px rgba(2,6,23,.35)",
        }}
      >
        {card ? renderCardFace(card, false) : <div style={{ width: "100%", height: "100%" }} />}
      </div>
      <div style={{ display: "grid", gap: 3, justifyItems: "center" }}>
        <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 11, textAlign: "center" }}>{subtitle}</div>
        {badge ? <StatusPill label={badge.label} tone={badge.tone} compact /> : null}
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
  const stockBadge = game.phase === "draw" ? { label: "Steg 1: dra", tone: "info" } : { label: "Redan dragit", tone: "neutral" };
  const discardBadge = game.discardFrozen
    ? { label: "Frusen hög", tone: "warning" }
    : canPickDiscardPile
      ? { label: "Kan tas", tone: "success" }
      : { label: "Kan inte tas", tone: "neutral" };
  const myMelds = myTeamZone?.melds ?? [];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 4 }}>
        {opponentPanels.map((panel) => (
          <OpponentPanel key={panel.teamId} panel={panel} />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          padding: "14px 12px 18px",
          borderRadius: 28,
          backgroundImage: [
            "radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,.03), transparent 55%)",
            "radial-gradient(80% 90% at 50% 50%, rgba(16,185,129,.08), transparent 70%)",
            "linear-gradient(180deg, #0a1a1a, #061112)",
          ].join(", "),
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), inset 0 -40px 60px rgba(2,6,23,.28), 0 18px 38px rgba(2,6,23,.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <StepIndicator phase={game.phase === "draw" ? "draw" : selectedSummary.canDiscardNow ? "discard" : "meld"} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {game.discardFrozen ? <StatusPill label="Frozen" tone="warning" compact /> : null}
            {canPickDiscardPile ? <StatusPill label="Takeable" tone="success" compact /> : null}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            alignItems: "stretch",
          }}
        >
          <PileButton
            title="Talong"
            subtitle={`${game.stock.length} kort`}
            onPress={drawTwo}
            disabled={!canDrawFromStock}
            renderCardFace={renderCardFace}
            accentTone={canDrawFromStock ? "info" : "neutral"}
            badge={stockBadge}
          />
          <PileButton
            title="Kasthög"
            subtitle={`${game.discard.length} kort`}
            onPress={game.phase === "draw" ? takeDiscardStack : tryDiscardSelected}
            disabled={game.phase === "draw" ? !canPickDiscardPile : !canDiscardSelectedCard}
            card={topDiscard}
            renderCardFace={renderCardFace}
            accentTone={canPickDiscardPile ? "success" : game.discardFrozen ? "warning" : "neutral"}
            badge={discardBadge}
          />
        </div>

        {myMelds.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ color: "rgba(226,232,240,.9)", fontWeight: 800, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>Melds</div>
              {!myTeamZone?.opened ? <StatusPill label="Not opened" tone="neutral" compact /> : null}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
            {myMelds.map((meld, index) => (
              <MyMeldCard
                key={`my-meld-${meld.rank}-${index}`}
                meld={meld}
                rankLabel={rankLabel}
                highlighted={selectedSummary.targetExistingRank === meld.rank && selectedSummary.canLayNow}
                onPress={() => {
                  if (selectedSummary.targetExistingRank === meld.rank && selectedSummary.canLayNow) laySelected();
                  else setExpandedTeamId(myTeamZone?.teamId ?? null);
                }}
              />
            ))}
            </div>
          </div>
        ) : null}
      </div>

      {selectedCards.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill label={`${selectedCards.length} selected`} tone="info" compact />
            <StatusPill label={selectedSummary.openingValueLabel} tone={selectedSummary.canOpenNow ? "success" : "warning"} compact />
            {selectedSummary.intentLabel ? <StatusPill label={selectedSummary.intentLabel} tone="success" compact /> : null}
          </div>
      ) : null}
    </div>
  );
}

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
        gap: 8,
        padding: 12,
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.16)",
        background: "linear-gradient(180deg, rgba(15,23,42,.9), rgba(2,6,23,.84))",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: 14 }}>{panel.label}</div>
          <div style={{ color: "#94a3b8", fontWeight: 600, fontSize: 11 }}>{panel.playerNames}</div>
        </div>
        <div
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            background: panel.opened ? "rgba(34,197,94,.14)" : "rgba(148,163,184,.12)",
            color: panel.opened ? "#86efac" : "#cbd5e1",
            fontSize: 10,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {panel.opened ? "Öppnat" : "Ej öppnat"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: 12 }}>Kort: {panel.handCount}</div>
        <div style={{ color: "#fde68a", fontWeight: 800, fontSize: 12 }}>Total: {Number(panel.total || 0).toLocaleString("sv-SE")}</div>
        <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 12 }}>Öppning: {panel.opening === "canasta" ? "Canasta" : panel.opening}</div>
      </div>
      {panel.melds?.length ? (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {panel.melds.map((meld, index) => (
            <MiniMeldChip key={`${panel.teamId}-meld-${meld.rank}-${index}`} meld={meld} rankLabel={panel.rankLabel} />
          ))}
        </div>
      ) : (
        <div style={{ color: "#64748b", fontWeight: 700, fontSize: 11 }}>Inga melds ännu</div>
      )}
    </div>
  );
}

function StatusPill({ label, tone = "neutral" }) {
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
        padding: "6px 10px",
        borderRadius: 999,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        fontWeight: 800,
        fontSize: 11,
        whiteSpace: "nowrap",
      }}
    >
      {label}
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
        gap: 10,
        justifyItems: "center",
        alignContent: "center",
        minHeight: 172,
        padding: 14,
        borderRadius: 22,
        border: `1px solid ${accentMap[accentTone] ?? accentMap.neutral}`,
        background: "linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.92))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), 0 12px 28px rgba(2,6,23,.25)",
        opacity: disabled ? 0.58 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: 15 }}>{title}</div>
      <div
        style={{
          width: 74,
          height: 104,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(148,163,184,.22)",
          background: card ? "#fffdf8" : "rgba(15,23,42,.75)",
          boxShadow: "0 10px 22px rgba(2,6,23,.25)",
        }}
      >
        {card ? renderCardFace(card, false) : <div style={{ width: "100%", height: "100%" }} />}
      </div>
      <div style={{ display: "grid", gap: 4, justifyItems: "center" }}>
        <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 12, textAlign: "center" }}>{subtitle}</div>
        {badge ? <StatusPill label={badge.label} tone={badge.tone} /> : null}
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
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 8 }}>
        {opponentPanels.map((panel) => (
          <OpponentPanel key={panel.teamId} panel={panel} />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 14,
          borderRadius: 22,
          border: "1px solid rgba(148,163,184,.16)",
          background: "linear-gradient(180deg, rgba(8,15,28,.94), rgba(2,6,23,.9))",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusPill label={selectedSummary.turnStepLabel} tone="info" />
          <StatusPill label={selectedSummary.openingStatus} tone={selectedSummary.canOpenNow ? "success" : selectedSummary.teamOpened ? "neutral" : "warning"} />
          <StatusPill label={selectedSummary.discardStatus} tone={game.discardFrozen ? "warning" : canPickDiscardPile ? "success" : "neutral"} />
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

        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,.14)",
            background: "rgba(15,23,42,.55)",
          }}
        >
          <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: 13 }}>{selectedSummary.centerHeadline}</div>
          <div style={{ color: "#94a3b8", fontWeight: 600, fontSize: 12, lineHeight: 1.4 }}>{selectedSummary.centerDetail}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: 15 }}>Mina melds</div>
          <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 11 }}>
            {myTeamZone?.opened ? "Laget är öppnat" : "Inte öppnat än"}
          </div>
        </div>
        {myMelds.length ? (
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
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
        ) : (
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              border: "1px dashed rgba(148,163,184,.18)",
              color: "#64748b",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Inga melds ännu. Markera kort i handen och använd actions för att öppna eller bygga vidare.
          </div>
        )}
        {selectedCards.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill label={`Markerade: ${selectedCards.length}`} tone="info" />
            <StatusPill label={`Öppningsvärde: ${selectedSummary.openingValueLabel}`} tone={selectedSummary.canOpenNow ? "success" : "warning"} />
            {selectedSummary.intentLabel ? <StatusPill label={selectedSummary.intentLabel} tone="success" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

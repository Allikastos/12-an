import CanastaMobileBoard from "./CanastaMobileBoard";
import CanastaErrorBoundary from "./CanastaErrorBoundary";

export default function CanastaBoardView({
  isMobile,
  isMobileLandscape,
  game,
  teamZones,
  roundResult,
  roundLeaderboardPoints,
  matchWinnerLabel,
  matchWinnerTeamId,
  targetScore,
  nextRoundCountdown,
  isHost,
  startNextRound,
  actionHint,
  isBotTurn,
  turnFlash,
  inactiveFlash,
  themeAccent,
  themeGlow1,
  themeGlow2,
  themeBgColor,
  cardBackImage,
  canDrawFromStock,
  drawTwo,
  topDiscard,
  canPickDiscardPile,
  takeDiscardStack,
  tryDiscardSelected,
  dragCardId,
  discard,
  setHoverCardId,
  canDiscardSelectedCard,
  visibleTeamZones,
  seatTemplates,
  myPlayerId,
  myTeamId,
  canLaySelectedCards,
  selectedIds,
  selectedCards,
  selectedSummary,
  laySelected,
  setExpandedTeamId,
  renderCardFace,
  renderTeamMelds,
  getTeamTotal,
  rankLabel,
}) {
  const safeGame = game ?? { players: [], discard: [], stock: [], phase: "draw", roundEnded: false, turnIndex: 0 };
  const safeTeamZones = teamZones ?? [];
  const otherPlayerHands = safeGame.players.filter((player) => player.id !== myPlayerId);
  const myTeamZone = safeTeamZones.find((zone) => zone.teamId === myTeamId) ?? null;
  const opponentPanels = safeTeamZones
    .filter((zone) => zone.teamId !== myTeamId)
    .map((zone) => {
      const players = safeGame.players.filter((player) => player.teamId === zone.teamId);
      return {
        teamId: zone.teamId,
        label: zone.label,
        playerNames: players.map((player) => player.name).join(" • "),
        handCount: players.reduce((sum, player) => sum + (player.hand?.length ?? 0), 0),
        total: getTeamTotal(zone.teamId),
        opening: zone.opening,
        opened: zone.opened,
        melds: zone.melds,
        rankLabel,
      };
    });

  if (isMobile) {
    return (
      <CanastaErrorBoundary>
        <CanastaMobileBoard
          game={safeGame}
          myTeamZone={myTeamZone}
          opponentPanels={opponentPanels}
          topDiscard={topDiscard}
          canDrawFromStock={canDrawFromStock}
          drawTwo={drawTwo}
          canPickDiscardPile={canPickDiscardPile}
          takeDiscardStack={takeDiscardStack}
          tryDiscardSelected={tryDiscardSelected}
          canDiscardSelectedCard={canDiscardSelectedCard}
          selectedCards={selectedCards}
          selectedSummary={selectedSummary}
          laySelected={laySelected}
          setExpandedTeamId={setExpandedTeamId}
          renderCardFace={renderCardFace}
          rankLabel={rankLabel}
        />
      </CanastaErrorBoundary>
    );
  }

  return (
    <>
      {!safeGame.roundEnded && actionHint ? (
        <div style={{ color: "#bfdbfe", fontWeight: 700, fontSize: 12 }}>{actionHint}</div>
      ) : null}
      {isBotTurn && !safeGame.roundEnded && (
        <div style={{ color: "#7dd3fc", fontWeight: 800 }}>Boten tänker...</div>
      )}
      {safeGame.roundEnded && (
        <div
          style={{
            color: "#86efac",
            fontWeight: 900,
            border: "1px solid rgba(134,239,172,.45)",
            background: "rgba(22,101,52,.25)",
            borderRadius: 12,
            padding: "8px 10px",
          }}
        >
          {roundResult?.winnerTeamId
            ? `Rundan är slut. Vinnande sida: ${
                safeTeamZones.find((zone) => zone.teamId === roundResult.winnerTeamId)?.label ??
                safeGame.players.find((p) => p.teamId === roundResult.winnerTeamId)?.name ??
                roundResult.winnerTeamId
              }`
            : "Rundan är slut."}
          {roundResult ? (
            <span style={{ display: "block", marginTop: 6 }}>
              Rondpoäng:{" "}
              {Object.entries(roundResult.scoresByTeam)
                .map(([teamId, score]) => {
                  const label =
                    safeTeamZones.find((zone) => zone.teamId === teamId)?.label ??
                    safeGame.players.find((p) => p.teamId === teamId)?.name ??
                    teamId;
                  return `${label} ${score >= 0 ? "+" : ""}${score}`;
                })
                .join(" • ")}
            </span>
          ) : null}
          {roundResult ? (
            <span style={{ display: "block", marginTop: 6 }}>
              Nya totaler:{" "}
              {Object.entries(roundResult.scoresByTeam)
                .map(([teamId]) => {
                  const label =
                    safeTeamZones.find((zone) => zone.teamId === teamId)?.label ??
                    safeGame.players.find((p) => p.teamId === teamId)?.name ??
                    teamId;
                  const total = getTeamTotal(teamId);
                  return `${label} ${total >= 0 ? "" : "-"}${Math.abs(total).toLocaleString("sv-SE")}`;
                })
                .join(" • ")}
            </span>
          ) : null}
          {roundLeaderboardPoints ? (
            <span style={{ display: "block", marginTop: 6 }}>
              Leaderboardpoäng: +{roundLeaderboardPoints.points} ({roundLeaderboardPoints.humans} vinnande spelare ×4
              {roundLeaderboardPoints.bots > 0 ? `, ${roundLeaderboardPoints.bots} vinnande bottar ×1` : ""})
            </span>
          ) : null}
          {matchWinnerLabel ? (
            <span style={{ display: "block", marginTop: 6 }}>
              Matchvinnare: {matchWinnerLabel} nådde {targetScore.toLocaleString("sv-SE")} poäng.
            </span>
          ) : null}
          {!matchWinnerTeamId && nextRoundCountdown != null ? (
            <span style={{ display: "block", marginTop: 8 }}>
              Nästa hand startar om {nextRoundCountdown} s.
            </span>
          ) : null}
          {matchWinnerTeamId ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {isHost && (
                <button
                  type="button"
                  onClick={startNextRound}
                  style={{
                    width: "auto",
                    borderRadius: 999,
                    padding: "10px 16px",
                    border: "1px solid rgba(148,163,184,.3)",
                    background: "linear-gradient(180deg, rgba(250,204,21,.28), rgba(234,179,8,.2))",
                    color: "#f8fafc",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Spela ny rond ändå
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "start" }}>
        <div
          style={{
            position: "relative",
            minHeight: isMobileLandscape ? 310 : isMobile ? 430 : 520,
            borderRadius: isMobile ? 16 : 24,
            border: `1px solid color-mix(in srgb, ${themeAccent} 55%, rgba(148,163,184,.35))`,
            backgroundImage: [
              `radial-gradient(90% 70% at 20% 18%, color-mix(in srgb, ${themeGlow1} 30%, transparent), transparent 70%)`,
              `radial-gradient(90% 70% at 80% 15%, color-mix(in srgb, ${themeGlow2} 28%, transparent), transparent 72%)`,
              `radial-gradient(95% 85% at 50% 50%, color-mix(in srgb, ${themeAccent} 14%, transparent), rgba(2,6,23,.68))`,
              `linear-gradient(180deg, color-mix(in srgb, ${themeBgColor} 80%, #020617), color-mix(in srgb, ${themeBgColor} 55%, #020617))`,
            ].join(", "),
            boxShadow: "inset 0 0 0 3px rgba(16,185,129,.2), 0 20px 50px rgba(2,6,23,.45)",
            overflow: "hidden",
          }}
        >
          {turnFlash && (
            <>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: "radial-gradient(circle at 50% 45%, rgba(56,189,248,.24), rgba(2,6,23,.48))",
                  animation: "canastaTurnBlink 1.45s ease-in-out both",
                  zIndex: 30,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  fontSize: 30,
                  color: "#e0f2fe",
                  textShadow: "0 0 18px rgba(56,189,248,.88), 0 0 40px rgba(2,132,199,.5)",
                  animation: "canastaTurnText 1.45s ease-out both",
                  zIndex: 31,
                }}
              >
                DIN TUR
              </div>
            </>
          )}
          {inactiveFlash && (
            <>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: "radial-gradient(circle at 50% 45%, rgba(248,113,113,.22), rgba(2,6,23,.52))",
                  animation: "canastaIdleBlink 1.2s ease-in-out infinite",
                  zIndex: 29,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  fontSize: 24,
                  color: "#fecaca",
                  textShadow: "0 0 14px rgba(248,113,113,.75)",
                  zIndex: 30,
                }}
              >
                DIN TUR
              </div>
            </>
          )}

          <button
            type="button"
            onClick={drawTwo}
            disabled={!canDrawFromStock}
            aria-label={game.stock.length === 0 ? "Avstå kasthögen" : "Dra två kort från talongen"}
            title={game.stock.length === 0 ? "Avstå kasthögen" : "Dra två kort"}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: isMobile ? "translate(-110%, -52%)" : "translate(-150%, -52%)",
              width: isMobile ? 48 : 72,
              height: isMobile ? 70 : 98,
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,.4)",
              background: cardBackImage,
              backgroundSize: "30px 30px, 16px 16px, 100% 100%",
              backgroundPosition: "center center, 0 0, 0 0",
              backgroundRepeat: "no-repeat, repeat, no-repeat",
              boxShadow: "0 8px 18px rgba(2,6,23,.45)",
              opacity: canDrawFromStock ? 1 : game.stock.length > 0 ? 0.72 : 0.45,
              zIndex: 4,
              cursor: canDrawFromStock ? "pointer" : "not-allowed",
              padding: 0,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: isMobile ? "translate(-110%, -56%)" : "translate(-150%, -56%)",
              width: isMobile ? 48 : 72,
              height: isMobile ? 70 : 98,
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,.3)",
              background: cardBackImage,
              backgroundSize: "30px 30px, 16px 16px, 100% 100%",
              backgroundPosition: "center center, 0 0, 0 0",
              backgroundRepeat: "no-repeat, repeat, no-repeat",
              opacity: game.stock.length > 2 ? 0.95 : 0.35,
              zIndex: 3,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: isMobile ? "translate(-110%, -60%)" : "translate(-150%, -60%)",
              width: isMobile ? 48 : 72,
              height: isMobile ? 70 : 98,
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,.4)",
              background: cardBackImage,
              backgroundSize: "30px 30px, 16px 16px, 100% 100%",
              backgroundPosition: "center center, 0 0, 0 0",
              backgroundRepeat: "no-repeat, repeat, no-repeat",
              opacity: game.stock.length > 5 ? 1 : 0.5,
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: isMobile ? "translate(-110%, 36px)" : "translate(-150%, 52px)",
              fontWeight: 900,
              fontSize: isMobile ? 11 : 12,
              color: "#dbeafe",
              zIndex: 5,
            }}
          >
            Talong: {game.stock.length}
          </div>

          <button
            type="button"
            onClick={() => {
              if (game.phase === "draw") {
                takeDiscardStack();
                return;
              }
              tryDiscardSelected();
            }}
            onDragOver={(e) => {
              if (isBotTurn || game.phase !== "discard" || game.roundEnded) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              if (isBotTurn || game.phase !== "discard" || game.roundEnded) return;
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragCardId;
              if (id) discard(id);
              setHoverCardId(null);
            }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: isMobile ? "translate(34%, -52%)" : "translate(78%, -52%)",
              width: isMobile ? 56 : 78,
              height: isMobile ? 78 : 106,
              borderRadius: 10,
              border: topDiscard ? "1px solid rgba(15,23,42,.38)" : "1px dashed rgba(148,163,184,.45)",
              background: topDiscard ? "#fffdf8" : "rgba(15,23,42,.58)",
              color: "#e2e8f0",
              fontWeight: 900,
              padding: "4px 4px",
              cursor:
                game.phase === "draw"
                  ? canPickDiscardPile
                    ? "pointer"
                    : "not-allowed"
                  : game.phase === "discard" && !isBotTurn && !game.roundEnded
                    ? "pointer"
                    : "not-allowed",
              opacity:
                game.phase === "draw"
                  ? canPickDiscardPile
                    ? 1
                    : 0.7
                  : game.phase === "discard" && !game.roundEnded
                    ? 1
                    : 0.75,
              boxShadow: topDiscard ? "0 10px 18px rgba(2,6,23,.4), 0 1px 0 rgba(255,255,255,.75) inset" : "none",
              zIndex: 5,
            }}
            disabled={game.phase === "draw" ? !canPickDiscardPile : !canDiscardSelectedCard}
            aria-label={game.phase === "draw" ? "Ta kasthögen" : "Släng markerat kort"}
            title={game.phase === "draw" ? "Ta kasthögen" : "Släng markerat kort"}
          >
            {renderCardFace(topDiscard, true)}
          </button>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: isMobile ? "translate(42%, 38px)" : "translate(84%, 56px)",
              textAlign: "center",
              fontWeight: 800,
              fontSize: isMobile ? 11 : 12,
              color: "#dbeafe",
              zIndex: 5,
            }}
          >
            Kasthög: {game.discard.length}
          </div>

          {otherPlayerHands.map((player, index) => {
            const seat = seatTemplates[index] ?? { top: "50%", left: "50%" };
            const leftPct = Number.parseFloat(String(seat.left).replace("%", ""));
            const topPct = Number.parseFloat(String(seat.top).replace("%", ""));
            const isSideSeat = leftPct <= 22 || leftPct >= 78;
            const isTopSeat = topPct <= 18;
            const count = player.hand?.length ?? 0;
            const visibleCount = Math.min(count, isMobile ? 8 : 10);
            const cardWidth = isMobile ? 11 : 13;
            const cardHeight = isMobile ? 17 : 20;
            const step = isMobile ? 4 : 5;
            const originLeft = isSideSeat ? (leftPct <= 22 ? "8%" : "92%") : seat.left;
            const originTop = isTopSeat ? "9%" : isSideSeat ? `${Math.max(20, Math.min(80, topPct))}%` : seat.top;

            return (
              <div
                key={`opp-hand-${player.id}`}
                style={{
                  position: "absolute",
                  left: originLeft,
                  top: originTop,
                  transform: "translate(-50%, -50%)",
                  zIndex: 7,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: isSideSeat ? cardWidth + 10 : Math.max(cardWidth, (visibleCount - 1) * step + cardWidth + 10),
                    height: isSideSeat ? Math.max(cardHeight, (visibleCount - 1) * step + cardHeight) + 12 : cardHeight + 12,
                  }}
                >
                  {Array.from({ length: visibleCount }, (_, cardIdx) => (
                    <div
                      key={`${player.id}-hidden-${cardIdx}`}
                      style={{
                        position: "absolute",
                        left: isSideSeat ? 0 : cardIdx * step,
                        top: isSideSeat ? cardIdx * step : 0,
                        width: cardWidth,
                        height: cardHeight,
                        borderRadius: 4,
                        border: "1px solid rgba(15,23,42,.45)",
                        background: cardBackImage,
                        backgroundSize: "16px 16px, 8px 8px, 100% 100%",
                        backgroundPosition: "center center, 0 0, 0 0",
                        backgroundRepeat: "no-repeat, repeat, no-repeat",
                        boxShadow: "0 2px 6px rgba(2,6,23,.35)",
                        opacity: 0.96,
                      }}
                    />
                  ))}
                  <div
                    style={{
                      position: "absolute",
                      right: -8,
                      bottom: -2,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      background: "rgba(2,6,23,.86)",
                      border: "1px solid rgba(148,163,184,.35)",
                      color: "#e2e8f0",
                      fontSize: 10,
                      fontWeight: 900,
                      display: "grid",
                      placeItems: "center",
                      padding: "0 5px",
                    }}
                  >
                    {count}
                  </div>
                </div>
              </div>
            );
          })}

          {visibleTeamZones.map((zone) => {
            const seat = seatTemplates[zone.anchorIndex] ?? { top: "50%", left: "50%", angle: 0 };
            const canOpenZone = (zone.melds?.length ?? 0) > 0 || (zone.redThreeCount ?? 0) > 0;
            const isMyZone = zone.teamId === myTeamId;
            const canLayToZone = isMyZone && canLaySelectedCards;
            const leftPct = Number.parseFloat(String(seat.left).replace("%", ""));
            const topPct = Number.parseFloat(String(seat.top).replace("%", ""));
            const isSideSeat = leftPct <= 22 || leftPct >= 78;
            const isBottomSeat = topPct >= 82;
            const sideRotate = isSideSeat ? (leftPct <= 22 ? 90 : -90) : 0;
            const sideLinearMode = isSideSeat;
            const zoneLeft = isMobile && isSideSeat ? (leftPct <= 22 ? "14%" : "86%") : seat.left;
            const zoneTop = isMobile && isSideSeat ? `${Math.max(20, Math.min(80, topPct))}%` : seat.top;

            return (
              <div
                key={zone.teamId}
                role={canOpenZone || canLayToZone ? "button" : undefined}
                tabIndex={canOpenZone || canLayToZone ? 0 : undefined}
                onClick={
                  canLayToZone
                    ? laySelected
                    : canOpenZone
                      ? () => setExpandedTeamId(zone.teamId)
                      : undefined
                }
                onKeyDown={
                  canOpenZone || canLayToZone
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (canLayToZone) laySelected();
                          else setExpandedTeamId(zone.teamId);
                        }
                      }
                    : undefined
                }
                style={{
                  position: "absolute",
                  left: zoneLeft,
                  top: zoneTop,
                  transform: `translate(-50%, -50%) rotate(${sideRotate}deg)`,
                  width: isMobile ? (isBottomSeat ? 210 : isSideSeat ? 110 : 150) : 220,
                  minHeight: isMobile ? (isBottomSeat ? 96 : isSideSeat ? 86 : 108) : 0,
                  maxWidth: isMobile ? (isBottomSeat ? "64%" : isSideSeat ? "30%" : "38%") : "42%",
                  zIndex: isMobile ? 2 : 6,
                  cursor: canLayToZone ? "copy" : canOpenZone ? "pointer" : "default",
                  pointerEvents: canLayToZone || canOpenZone ? "auto" : "none",
                }}
              >
                {renderTeamMelds({
                  title: `${zone.label}${zone.opened ? " • öppnat" : ""}${canLayToZone ? ` • lägg ${selectedIds.length}` : ""}`,
                  redThreeCount: zone.redThreeCount,
                  melds: zone.melds,
                  orientation: "horizontal",
                  compact: isMobile,
                  showStackLayers: !sideLinearMode,
                  noWrap: sideLinearMode,
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

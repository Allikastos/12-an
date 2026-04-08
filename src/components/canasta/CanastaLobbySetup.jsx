import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";

export default function CanastaLobbySetup({
  isMobile,
  mode,
  targetScore,
  roomCode,
  isHost,
  hostName,
  lobbyPlayers,
  targetLobbySize,
  lobbyCount,
  humansInLobby,
  botsInLobby,
  lobbySeats,
  seatPlayers,
  openSeatCount,
  friends,
  sentInvites,
  invitePanelOpen,
  setInvitePanelOpen,
  onSendRoomInvite,
  onShareRoom,
  lobbyStatus,
  transitioningToGame,
  setMode,
  setTargetScore,
  addBotToLobby,
  removeLobbyPlayer,
  start,
  handleBack,
}) {
  const canStart = isHost && lobbyCount === targetLobbySize;

  return (
    <Card
      style={{
        position: "relative",
        padding: 20,
        background: "linear-gradient(180deg, rgba(8,12,20,.99), rgba(10,16,30,.985))",
        border: "1px solid rgba(148,163,184,.35)",
        boxShadow: "0 22px 56px rgba(2,6,23,.52)",
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            padding: 16,
            borderRadius: 18,
            border: "1px solid rgba(125,211,252,.22)",
            background:
              "radial-gradient(circle at top left, rgba(56,189,248,.16), transparent 42%), radial-gradient(circle at top right, rgba(34,197,94,.14), transparent 40%), rgba(255,255,255,.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <h2 style={{ margin: 0 }}>Canasta-lobby</h2>
              <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                Bygg bordet innan ni startar. Singel spelas alltid 1 mot 1 och lag alltid 2v2.
              </div>
            </div>
            <div
              style={{
                minWidth: 150,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,.24)",
                background: "rgba(2,6,23,.42)",
              }}
            >
              <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Rumskod</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1.4 }}>
                {roomCode ? roomCode.toUpperCase() : "INGEN"}
              </div>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              minHeight: isMobile ? 300 : 360,
              borderRadius: isMobile ? 18 : 24,
              border: "1px solid rgba(34,197,94,.28)",
              backgroundImage: [
                "radial-gradient(circle at 18% 18%, rgba(56,189,248,.18), transparent 34%)",
                "radial-gradient(circle at 82% 12%, rgba(34,197,94,.14), transparent 30%)",
                "linear-gradient(180deg, rgba(8,40,48,.96), rgba(3,20,34,.98))",
              ].join(", "),
              boxShadow: "inset 0 0 0 2px rgba(16,185,129,.16), 0 16px 40px rgba(2,6,23,.3)",
              overflow: "hidden",
            }}
          >
            {seatPlayers.map((player, idx) => {
              const seat = lobbySeats[idx] ?? lobbySeats[0] ?? { top: "90%", left: "50%" };
              const isOpenSeat = !player;
              return (
                <div
                  key={player ? `seat-${player.id}` : `seat-open-${idx}`}
                  style={{
                    position: "absolute",
                    left: seat.left,
                    top: seat.top,
                    transform: "translate(-50%, -50%)",
                    minWidth: isMobile ? 104 : 132,
                    padding: isMobile ? "10px 10px" : "12px 12px",
                    borderRadius: 16,
                    border: isOpenSeat
                      ? "1px dashed rgba(148,163,184,.3)"
                      : idx === 0
                      ? "1px solid rgba(56,189,248,.55)"
                      : "1px solid rgba(148,163,184,.24)",
                    background: isOpenSeat
                      ? "linear-gradient(180deg, rgba(15,23,42,.28), rgba(5,12,18,.18))"
                      : idx === 0
                      ? "linear-gradient(180deg, rgba(8,47,73,.88), rgba(8,24,40,.92))"
                      : "linear-gradient(180deg, rgba(15,23,42,.88), rgba(5,12,18,.92))",
                    boxShadow: "0 10px 24px rgba(2,6,23,.34)",
                    textAlign: "center",
                    opacity: isOpenSeat ? 0.82 : 1,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: isMobile ? 14 : 15 }}>
                    {isOpenSeat ? "Ledig plats" : player.name || (player.isBot ? `Bot ${idx}` : `Spelare ${idx + 1}`)}
                  </div>
                  <div
                    style={{
                      color: isOpenSeat ? "rgba(191,219,254,.72)" : player.isBot ? "#fde68a" : "#93c5fd",
                      fontWeight: 800,
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {isOpenSeat
                      ? roomCode
                        ? "Joina via kod"
                        : "Väntar"
                      : idx === 0
                      ? isHost
                        ? "Värd"
                        : "Du"
                      : player.isBot
                      ? "Bot"
                      : "Spelare"}
                  </div>
                </div>
              );
            })}

            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: isMobile ? 128 : 170,
                height: isMobile ? 88 : 112,
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,.18)",
                background: "rgba(255,255,255,.03)",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: isMobile ? 16 : 18 }}>Match till</div>
              <div style={{ color: "#fde68a", fontWeight: 900, fontSize: isMobile ? 22 : 28 }}>
                {targetScore.toLocaleString("sv-SE")}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <LobbyStat label="Spellage" value={mode === "team" ? "Lag 2v2" : "Singel"} />
            <LobbyStat label="Spelare" value={`${lobbyCount}/${targetLobbySize}`} />
            <LobbyStat label="Manniskor" value={humansInLobby} />
            <LobbyStat label="Bottar" value={botsInLobby} />
            <LobbyStat label="Leaderboardbonus" value={targetScore === 5000 ? "Halv" : "Full"} />
            <LobbyStat label="Lediga platser" value={openSeatCount} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant={mode === "single" ? "primary" : "ghost"} onClick={() => setMode("single")} disabled={!isHost}>
            Singel
          </Button>
          <Button variant={mode === "team" ? "primary" : "ghost"} onClick={() => setMode("team")} disabled={!isHost}>
            Lag (2v2)
          </Button>
          <Button onClick={addBotToLobby} disabled={!isHost || lobbyCount >= targetLobbySize}>
            Lägg till bot
          </Button>
          <Button variant={targetScore === 5000 ? "primary" : "ghost"} onClick={() => setTargetScore(5000)} disabled={!isHost}>
            5 000 poäng
          </Button>
          <Button variant={targetScore === 10000 ? "primary" : "ghost"} onClick={() => setTargetScore(10000)} disabled={!isHost}>
            10 000 poäng
          </Button>
          <Button
            variant="ghost"
            onClick={() => onShareRoom?.()}
            disabled={!roomCode || typeof onShareRoom !== "function"}
            style={{ width: "auto" }}
          >
            Dela rum
          </Button>
        </div>

        {!isHost ? (
          <Notice tone="warn">{hostName ? `${hostName} är värd och startar matchen.` : "Värden startar matchen."}</Notice>
        ) : (
          <Notice tone="info">Du är värd. Bjud in vänner med rumskoden eller fyll ut bordet med bottar innan du startar matchen.</Notice>
        )}

        {lobbyPlayers.some((p, idx) => idx > 0 && p?.isBot) && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              padding: 12,
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,.2)",
              background: "rgba(255,255,255,.025)",
            }}
          >
            <div style={{ fontWeight: 900 }}>Bottar i lobbyn</div>
            {lobbyPlayers
              .filter((p, idx) => idx > 0 && p?.isBot)
              .map((bot) => (
                <div
                  key={bot.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 999,
                    background: "rgba(2,6,23,.34)",
                    border: "1px solid rgba(148,163,184,.16)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{bot.name}</div>
                  <Button
                    variant="ghost"
                    style={{ width: "auto", padding: "4px 8px" }}
                    onClick={() => removeLobbyPlayer(bot.id)}
                    disabled={!isHost}
                  >
                    Ta bort
                  </Button>
                </div>
              ))}
          </div>
        )}

        {friends.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 14,
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,.2)",
              background: "rgba(255,255,255,.025)",
            }}
          >
            <button
              type="button"
              onClick={() => setInvitePanelOpen((open) => !open)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                width: "100%",
                background: "transparent",
                border: "none",
                color: "inherit",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 900 }}>Bjud in vänner</div>
                <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                  Inbjudningar skickas till samma rumskod som visas ovan.
                </div>
              </div>
              <div style={{ color: "#bfdbfe", fontWeight: 900, fontSize: 13 }}>
                {invitePanelOpen ? "Dölj" : `Visa (${friends.length})`}
              </div>
            </button>
            {invitePanelOpen && (
              <div style={{ display: "grid", gap: 8 }}>
                {friends.map((friend) => {
                  const sent = Boolean(sentInvites?.[friend.id]);
                  return (
                    <div
                      key={friend.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 10px",
                        borderRadius: 12,
                        background: "rgba(2,6,23,.28)",
                        border: "1px solid rgba(148,163,184,.16)",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{friend.display_name}</div>
                      <Button
                        variant={sent ? "primary" : "ghost"}
                        onClick={() => onSendRoomInvite?.(friend.id)}
                        disabled={!roomCode || sent || typeof onSendRoomInvite !== "function" || lobbyCount >= targetLobbySize}
                        style={{ width: "auto", padding: "6px 10px" }}
                      >
                        {sent ? "Skickat" : "Bjud in"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === "team" ? (
          <div style={{ color: "#fde68a", fontWeight: 700, fontSize: 12 }}>Lagläge kräver exakt 4 spelare.</div>
        ) : (
          <div style={{ color: "#fde68a", fontWeight: 700, fontSize: 12 }}>Singel spelas endast 1 mot 1 och kräver exakt 2 spelare.</div>
        )}
        {lobbyStatus && <div style={{ color: "#93c5fd", fontWeight: 700, fontSize: 12 }}>{lobbyStatus}</div>}
        {targetScore === 5000 && (
          <div style={{ color: "#bfdbfe", fontWeight: 700, fontSize: 12 }}>
            5 000-poängsmatch ger halva leaderboardbonusen jämfört med 10 000.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isHost ? (
            <Button onClick={start} disabled={!canStart}>
              {lobbyCount < targetLobbySize ? "Fyll lobbyn" : "Starta match"}
            </Button>
          ) : (
            <Button variant="ghost" disabled>
              Väntar på värden
            </Button>
          )}
          <Button variant="ghost" onClick={handleBack}>
            Tillbaka
          </Button>
        </div>
      </div>

      {transitioningToGame && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "grid",
            placeItems: "center",
            background: "radial-gradient(circle at 50% 45%, rgba(34,197,94,.18), rgba(2,6,23,.86))",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              padding: "18px 22px",
              borderRadius: 20,
              border: "1px solid rgba(125,211,252,.28)",
              background: "rgba(8,12,20,.82)",
              boxShadow: "0 18px 40px rgba(2,6,23,.44)",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#e2e8f0", fontWeight: 900, fontSize: isMobile ? 24 : 30 }}>Match startar</div>
            <div style={{ color: "#93c5fd", fontWeight: 700, marginTop: 6 }}>Bordet förbereds...</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function LobbyStat({ label, value }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(2,6,23,.34)", border: "1px solid rgba(148,163,184,.18)" }}>
      <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function Notice({ tone, children }) {
  const palette =
    tone === "warn"
      ? {
          border: "1px solid rgba(250,204,21,.28)",
          background: "rgba(250,204,21,.08)",
          color: "#fde68a",
        }
      : {
          border: "1px solid rgba(56,189,248,.24)",
          background: "rgba(56,189,248,.08)",
          color: "#bae6fd",
        };

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        fontWeight: 800,
        ...palette,
      }}
    >
      {children}
    </div>
  );
}

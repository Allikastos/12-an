import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";

export default function CanastaSettingsModal({
  settingsOpen,
  setSettingsOpen,
  vibrateOnTurn,
  setVibrateOnTurn,
  roomCode,
  lobbyPlayers,
  mode,
  hostName,
  onShareRoom,
  targetScore,
  friends,
  sentInvites,
  onSendRoomInvite,
  canCustomizeTheme,
  applyTheme,
  themes,
  themeCategory,
  setThemeCategory,
  standardThemes,
  specialThemes,
  visibleThemes,
  externalSettings,
  themeBgColor,
  themeAccent,
  themeGlow1,
  themeGlow2,
  setExternalSettings,
}) {
  if (!settingsOpen) return null;

  const settingsSectionStyle = {
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,.26)",
    background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)",
  };
  const settingsSectionTitleStyle = {
    color: "#c7d2fe",
    fontWeight: 900,
    marginBottom: 10,
    letterSpacing: 0.2,
    fontSize: 12,
    textTransform: "uppercase",
  };
  const settingsInlineRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,.2)",
    background: "rgba(15,23,42,.36)",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setSettingsOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(2,6,23,.64)",
        backdropFilter: "blur(3px)",
        display: "grid",
        placeItems: "center",
        padding: 14,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(960px, 96vw)" }}>
        <Card style={{ maxHeight: "88vh", overflow: "auto", padding: 18, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>Inställningar</h3>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)} style={{ width: "auto" }}>
              Stäng
            </Button>
          </div>
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div style={settingsSectionStyle}>
              <div style={settingsSectionTitleStyle}>Alert</div>
              <div style={settingsInlineRowStyle}>
                <div>
                  <div style={{ fontWeight: 800 }}>Vibrera när turen byter</div>
                  <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12, marginTop: 2 }}>
                    Samma typ av turnotifiering som i 12:an.
                  </div>
                </div>
                <Button variant={vibrateOnTurn ? "primary" : "ghost"} onClick={() => setVibrateOnTurn((v) => !v)} style={{ width: "auto" }}>
                  {vibrateOnTurn ? "På" : "Av"}
                </Button>
              </div>
            </div>
            <div style={settingsSectionStyle}>
              <div style={settingsSectionTitleStyle}>Lobby</div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.03)" }}>
                    <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Rumskod</div>
                    <div style={{ fontWeight: 900, fontSize: 20, marginTop: 2 }}>{roomCode ? roomCode.toUpperCase() : "Inte kopplad"}</div>
                  </div>
                  <div style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.03)" }}>
                    <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Bord</div>
                    <div style={{ fontWeight: 900, fontSize: 20, marginTop: 2 }}>
                      {lobbyPlayers.length}/{mode === "team" ? 4 : 2} spelare
                    </div>
                  </div>
                </div>
                <div style={settingsInlineRowStyle}>
                  <div>
                    <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Värd</div>
                    <div style={{ fontWeight: 800 }}>{hostName || lobbyPlayers[0]?.name || "Inte satt"}</div>
                  </div>
                  <Button variant="ghost" onClick={() => onShareRoom?.()} disabled={!roomCode || typeof onShareRoom !== "function"} style={{ width: "auto" }}>
                    Dela
                  </Button>
                </div>
                <div style={settingsInlineRowStyle}>
                  <div>
                    <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Spelläge</div>
                    <div style={{ fontWeight: 800 }}>{mode === "team" ? "Lag 2v2" : "Singel"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Matchmål</div>
                    <div style={{ fontWeight: 800 }}>{targetScore.toLocaleString("sv-SE")} poäng</div>
                  </div>
                </div>
                <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                  Canasta körs här bara som 1 mot 1 i singel eller 2v2 i lagspel.
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {friends.length === 0 ? (
                    <div style={{ color: "var(--muted)" }}>Inga vänner att bjuda in just nu.</div>
                  ) : (
                    friends.map((friend) => {
                      const sent = Boolean(sentInvites?.[friend.id]);
                      return (
                        <div
                          key={friend.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            gap: 10,
                            padding: 8,
                            borderRadius: 10,
                            border: "1px solid rgba(148,163,184,.2)",
                            background: "rgba(15,23,42,.28)",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{friend.display_name}</div>
                          <Button
                            variant={sent ? "primary" : "ghost"}
                            onClick={() => onSendRoomInvite?.(friend.id)}
                            disabled={!roomCode || sent || typeof onSendRoomInvite !== "function"}
                            style={{ width: "auto", padding: "6px 10px" }}
                          >
                            {sent ? "Skickat" : "Bjud in"}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            {canCustomizeTheme && (
              <div style={settingsSectionStyle}>
                <div style={settingsSectionTitleStyle}>Tema</div>
                {typeof applyTheme === "function" && themes.length > 0 && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <Button variant={themeCategory === "standard" ? "primary" : "ghost"} onClick={() => setThemeCategory("standard")} style={{ padding: "8px 12px" }}>
                        Standard ({standardThemes.length})
                      </Button>
                      <Button variant={themeCategory === "special" ? "primary" : "ghost"} onClick={() => setThemeCategory("special")} style={{ padding: "8px 12px" }}>
                        Specials ({specialThemes.length})
                      </Button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
                      {visibleThemes.map((t) => {
                        const key = t.key ?? t.name;
                        const selected = externalSettings?.themeKey === key;
                        return (
                          <Button key={key} variant={selected ? "primary" : "ghost"} onClick={() => applyTheme(t)} style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                            <div
                              style={{
                                width: "100%",
                                height: 46,
                                borderRadius: 10,
                                border: "1px solid rgba(148,163,184,.25)",
                                backgroundImage: [
                                  `radial-gradient(120px 60px at 15% 20%, color-mix(in srgb, ${t.bgGlow1} 28%, transparent), transparent 70%)`,
                                  `radial-gradient(120px 60px at 85% 10%, color-mix(in srgb, ${t.bgGlow2} 24%, transparent), transparent 70%)`,
                                  `linear-gradient(180deg, #0a0f1b, ${t.bgColor})`,
                                ].join(", "),
                              }}
                            />
                            <div style={{ fontWeight: 800, fontSize: 12 }}>{t.name}</div>
                          </Button>
                        );
                      })}
                    </div>
                  </>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                  <label style={{ display: "grid", gap: 4, color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                    Bakgrund
                    <input
                      type="color"
                      value={themeBgColor}
                      onChange={(e) => setExternalSettings((s) => ({ ...s, bgColor: e.target.value }))}
                      style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(148,163,184,.35)", background: "transparent" }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4, color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                    Accent
                    <input
                      type="color"
                      value={themeAccent}
                      onChange={(e) => setExternalSettings((s) => ({ ...s, accentColor: e.target.value, checkColor: e.target.value, filledRingColor: e.target.value }))}
                      style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(148,163,184,.35)", background: "transparent" }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4, color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                    Glow 1
                    <input
                      type="color"
                      value={themeGlow1}
                      onChange={(e) => setExternalSettings((s) => ({ ...s, bgGlow1: e.target.value }))}
                      style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(148,163,184,.35)", background: "transparent" }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4, color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                    Glow 2
                    <input
                      type="color"
                      value={themeGlow2}
                      onChange={(e) => setExternalSettings((s) => ({ ...s, bgGlow2: e.target.value }))}
                      style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(148,163,184,.35)", background: "transparent" }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

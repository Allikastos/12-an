import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { leaveRoom } from "./services/leave";
import { touchPlayer } from "./services/presence";

import { Container } from "./ui/Container";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

import ScoreSheet from "./components/ScoreSheet";
import { weightedProgress, isWin, ROWS } from "./game/weights";
import { loadSheet, saveSheet, clearSheet, loadSettings, saveSettings } from "./game/storage";

import {
  createRoomWithCode,
  getRoomByCode,
  getPlayerByDevice,
  createPlayer,
  ensureScore,
} from "./services/rooms";

function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function getOrCreateDeviceId() {
  const key = "scoreboard_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function emptySheet() {
  const s = {};
  for (const r of ROWS) s[r] = 0;
  return s;
}

export default function App() {
  const [deviceId] = useState(() => getOrCreateDeviceId());

  const [step, setStep] = useState("home"); // home | room
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  // Poängblad + settings (lokalt först)
  const [sheet, setSheet] = useState(() => loadSheet() ?? emptySheet());
  const [settings, setSettings] = useState(() => loadSettings() ?? {
    boxSize: "medium",
    checkColor: "var(--accent)",
    rowCompleteBg: "rgba(34,197,94,.12)",
    showDice: false, // tillval senare
  });

  const [showSettings, setShowSettings] = useState(false);

  // För att Online/Pausad och progress ska kännas levande
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Spara sheet/settings lokalt
  useEffect(() => {
    saveSheet(sheet);
  }, [sheet]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Auto-restore (safe) av lobby/session
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const savedCode = localStorage.getItem("scoreboard_room_code");
      const savedRoomId = localStorage.getItem("scoreboard_room_id");
      const savedPlayerId = localStorage.getItem("scoreboard_player_id");

      if (!savedCode || !savedRoomId || !savedPlayerId) return;

      const { data: room, error: roomErr } = await getRoomByCode(savedCode);
      if (roomErr || !room) {
        localStorage.removeItem("scoreboard_room_code");
        localStorage.removeItem("scoreboard_room_id");
        localStorage.removeItem("scoreboard_player_id");
        return;
      }

      const { data: existing } = await getPlayerByDevice(room.id, deviceId);

      let player = existing ?? null;
      if (!player) {
        const { data: p } = await supabase
          .from("players")
          .select("*")
          .eq("id", savedPlayerId)
          .eq("room_id", room.id)
          .maybeSingle();
        player = p ?? null;
      }

      if (!player) {
        localStorage.removeItem("scoreboard_room_code");
        localStorage.removeItem("scoreboard_room_id");
        localStorage.removeItem("scoreboard_player_id");
        return;
      }

      await ensureScore(room.id, player.id);

      if (cancelled) return;

      setRoomCode(savedCode);
      setRoomId(room.id);
      setPlayerId(player.id);
      if (!name && player.name) setName(player.name);
      setStep("room");

      localStorage.setItem("scoreboard_room_code", savedCode);
      localStorage.setItem("scoreboard_room_id", room.id);
      localStorage.setItem("scoreboard_player_id", player.id);
    }

    restore();
    return () => { cancelled = true; };
  }, [deviceId, name]);

  const canJoin = useMemo(
    () => roomCode.trim().length >= 4 && name.trim().length >= 2,
    [roomCode, name]
  );

  async function createRoom() {
    const code = makeCode(6);
    const { data: room, error } = await createRoomWithCode(code);
    if (error) return alert(error.message);

    setRoomCode(code);
    await joinRoom(code);
  }

  async function joinRoom(codeParam) {
    const code = (codeParam ?? roomCode).trim().toUpperCase();
    const playerName = name.trim();

    const { data: room, error: roomErr } = await getRoomByCode(code);
    if (roomErr) return alert("Rummet hittades inte. Kontrollera koden.");

    let player = null;
    const { data: existing, error: existingErr } = await getPlayerByDevice(room.id, deviceId);

    if (!existingErr && existing) {
      player = existing;
      if (playerName && playerName !== player.name) {
        await supabase.from("players").update({ name: playerName }).eq("id", player.id);
        player = { ...player, name: playerName };
      }
    } else {
      const { data: created, error: playerErr } = await createPlayer(room.id, playerName, deviceId);
      if (playerErr) return alert(playerErr.message);
      player = created;
    }

    const { error: scoreErr } = await ensureScore(room.id, player.id);
    if (scoreErr) return alert(scoreErr.message);

    localStorage.setItem("scoreboard_room_code", code);
    localStorage.setItem("scoreboard_room_id", room.id);
    localStorage.setItem("scoreboard_player_id", player.id);

    setRoomCode(code);
    setRoomId(room.id);
    setPlayerId(player.id);
    setStep("room");
  }

  async function handleLeave() {
    try {
      await leaveRoom(roomId, playerId);
    } finally {
      localStorage.removeItem("scoreboard_room_code");
      localStorage.removeItem("scoreboard_room_id");
      localStorage.removeItem("scoreboard_player_id");
      window.location.reload();
    }
  }

  // Presence heartbeat (så lobby kan visa online senare)
  useEffect(() => {
    if (!roomId || !playerId) return;

    touchPlayer(playerId);
    let heartbeatId = setInterval(() => touchPlayer(playerId), 5 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (heartbeatId) {
          clearInterval(heartbeatId);
          heartbeatId = null;
        }
      } else {
        touchPlayer(playerId);
        if (!heartbeatId) heartbeatId = setInterval(() => touchPlayer(playerId), 5 * 1000);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (heartbeatId) clearInterval(heartbeatId);
    };
  }, [roomId, playerId]);

  // --- Poängblad actions ---
  const inc = (row) => {
    setSheet((prev) => {
      const next = { ...prev };
      next[row] = Math.min(7, Number(next[row] ?? 0) + 1);
      return next;
    });
  };

  const dec = (row) => {
    setSheet((prev) => {
      const next = { ...prev };
      next[row] = Math.max(0, Number(next[row] ?? 0) - 1);
      return next;
    });
  };

  const progress = weightedProgress(sheet);
  const won = isWin(sheet);

  function resetSheet() {
    clearSheet();
    setSheet(emptySheet());
  }

  // ------------------ UI ------------------
  if (step === "home") {
    return (
      <Container>
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28 }}>12:an</h1>
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>Poängblad</span>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
              Ditt namn
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
              Rumskod
            </label>
            <Input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="t.ex. A1B2C3"
              style={{ textTransform: "uppercase" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <Button onClick={createRoom}>Skapa rum</Button>
            <Button variant="ghost" onClick={() => joinRoom()} disabled={!canJoin}>
              Joina rum
            </Button>
          </div>

          <p style={{ marginTop: 14, color: "var(--muted)" }}>
            Skapa rum → dela koden → alla kan använda samma lobby.
          </p>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card style={{ padding: 22 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <div style={{ color: "var(--muted)", fontWeight: 800, letterSpacing: 0.2 }}>RUM</div>
            <h2 style={{ margin: "6px 0 0", fontSize: 24 }}>{roomCode.toUpperCase()}</h2>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={() => setShowSettings(true)}>
              Inställningar
            </Button>
            <Button variant="danger" onClick={handleLeave}>
              Lämna
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>Färdigt (viktat)</span>
            <span style={{ fontWeight: 900 }}>{Math.round(progress * 100)}%</span>
          </div>
          <div style={{ height: 10, background: "rgba(148,163,184,.25)", borderRadius: 999 }}>
            <div
              style={{
                height: 10,
                width: `${Math.round(progress * 100)}%`,
                background: "var(--accent)",
                borderRadius: 999,
                transition: "width .2s ease",
              }}
            />
          </div>
        </div>

        {/* Win message */}
        {won && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "rgba(34,197,94,.12)",
              fontWeight: 900,
            }}
          >
            Du vann! Alla rader är klara.
          </div>
        )}

        {/* Sheet */}
        <div style={{ marginTop: 18 }}>
          <ScoreSheet sheet={sheet} onIncrement={inc} onDecrement={dec} settings={settings} />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Dela koden <b>{roomCode.toUpperCase()}</b> så kan andra ansluta.
          </p>
          <Button variant="ghost" onClick={resetSheet}>
            Återställ spel
          </Button>
        </div>
      </Card>

      {/* Settings modal (enkel inline) */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 100%)" }}>
            <Card style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0 }}>Inställningar</h3>
                <Button variant="ghost" onClick={() => setShowSettings(false)}>Stäng</Button>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                <div>
                  <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Box Size</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <Button
                      variant={settings.boxSize === "small" ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, boxSize: "small" }))}
                    >
                      Small
                    </Button>
                    <Button
                      variant={settings.boxSize === "medium" ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, boxSize: "medium" }))}
                    >
                      Medium
                    </Button>
                    <Button
                      variant={settings.boxSize === "large" ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, boxSize: "large" }))}
                    >
                      Large
                    </Button>
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Lobby</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ color: "var(--muted)", fontWeight: 700 }}>Rumskod</div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{roomCode.toUpperCase()}</div>
                    </div>
                    <Button variant="danger" onClick={handleLeave}>Lämna lobby</Button>
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 8 }}>Tärningar i appen</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ color: "var(--muted)" }}>
                      Valfritt. Du kan ha fysiska tärningar och bara använda poängbladet.
                    </div>
                    <Button
                      variant={settings.showDice ? "primary" : "ghost"}
                      onClick={() => setSettings((s) => ({ ...s, showDice: !s.showDice }))}
                    >
                      {settings.showDice ? "På" : "Av"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </Container>
  );
}

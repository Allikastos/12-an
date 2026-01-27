import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { leaveRoom } from "./services/leave";
import { touchPlayer } from "./services/presence";

import { Container } from "./ui/Container";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

import ScoreSheet from "./components/ScoreSheet";

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
    // Robust fallback (undviker vit sida om randomUUID saknas)
    id =
      globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function emptyProgress() {
  const obj = {};
  for (let r = 1; r <= 12; r++) obj[r] = Array(7).fill(false);
  return obj;
}

function isProgressWin(p) {
  for (let r = 1; r <= 12; r++) {
    const row = p?.[r];
    if (!row || row.length !== 7 || !row.every(Boolean)) return false;
  }
  return true;
}

export default function App() {
  const [deviceId] = useState(() => getOrCreateDeviceId());

  const [step, setStep] = useState("home"); // home | room
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  // Settings (globalt)
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem("scoreboard_settings_v1");
      return raw
        ? JSON.parse(raw)
        : {
            boxSize: "medium",
            checkColor: "var(--accent)",
            rowCompleteBg: "rgba(34,197,94,.12)",
            showDice: false, // tillval senare
          };
    } catch {
      return {
        boxSize: "medium",
        checkColor: "var(--accent)",
        rowCompleteBg: "rgba(34,197,94,.12)",
        showDice: false,
      };
    }
  });

  useEffect(() => {
    localStorage.setItem("scoreboard_settings_v1", JSON.stringify(settings));
  }, [settings]);

  const [showSettings, setShowSettings] = useState(false);

  // Progress lagras per rum+spelare (så olika personer får egna blad i samma lobby)
  const progressStorageKey = useMemo(() => {
    if (roomId && playerId) return `t12_progress_${roomId}_${playerId}`;
    return "t12_progress_local";
  }, [roomId, playerId]);

  const [progress, setProgress] = useState(() => {
    try {
      const raw = localStorage.getItem("t12_progress_local");
      return raw ? JSON.parse(raw) : emptyProgress();
    } catch {
      return emptyProgress();
    }
  });

  const [showWin, setShowWin] = useState(false);
// --- Top stats (för headern) ---
const TOTAL_BOXES = 12 * 7;

const completedBoxes = useMemo(() => {
  if (!progress) return 0;
  let c = 0;
  for (let r = 1; r <= 12; r++) {
    const row = progress[r] ?? [];
    for (let i = 0; i < 7; i++) if (row[i]) c++;
  }
  return c;
}, [progress]);

const completedRows = useMemo(() => {
  if (!progress) return 0;
  let rows = 0;
  for (let r = 1; r <= 12; r++) {
    const row = progress[r] ?? [];
    if (row.length === 7 && row.every(Boolean)) rows++;
  }
  return rows;
}, [progress]);

// OBS: Den här "weightedPercent" använder din befintliga `progress` (0..1).
// Om din `progress` inte är 0..1: säg till så justerar vi.
const weightedPercent = Math.round((progress ?? 0) * 100);

  // När man byter rum/spelare: ladda rätt progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(progressStorageKey);
      const p = raw ? JSON.parse(raw) : emptyProgress();
      setProgress(p);
      setShowWin(isProgressWin(p));
    } catch {
      const p = emptyProgress();
      setProgress(p);
      setShowWin(false);
    }
  }, [progressStorageKey]);

  // Spara progress när det ändras
  useEffect(() => {
    localStorage.setItem(progressStorageKey, JSON.stringify(progress));
  }, [progress, progressStorageKey]);

  // Force tick för att UI känns levande (valfritt men ok)
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-restore lobby/session
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
    return () => {
      cancelled = true;
    };
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
    if (roomErr || !room) return alert("Rummet hittades inte. Kontrollera koden.");

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

  // Presence heartbeat
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

  // Poängblad actions
  function toggleCell(row, idx) {
    setProgress((prev) => {
      const base = prev && typeof prev === "object" ? prev : emptyProgress();
      const next = { ...base, [row]: [...(base[row] ?? Array(7).fill(false))] };
      next[row][idx] = !next[row][idx];

      const won = isProgressWin(next);
      setShowWin(won);

      return next;
    });
  }

  function resetProgress() {
    const p = emptyProgress();
    setProgress(p);
    setShowWin(false);
  }

  // ---------------- UI ----------------
  if (step === "home") {
    return (
      <Container>
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28 }}>12:an</h1>
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>Poängblad</span>
          </div>
{/* Stats (0/84, klara summor, viktad %) */}
<div
  style={{
    marginTop: 14,
    padding: 14,
    border: "1px solid var(--border)",
    borderRadius: 16,
    background: "rgba(255,255,255,.02)",
  }}
>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 12,
      alignItems: "end",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 900 }}>{completedBoxes}</div>
      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
        av {TOTAL_BOXES}
      </div>
    </div>

    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 900 }}>{completedRows}</div>
      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
        klara summor
      </div>
    </div>

    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 900 }}>{weightedPercent}%</div>
      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
        färdigt (viktat)
      </div>
    </div>
  </div>

  <div style={{ marginTop: 12 }}>
    <div style={{ height: 10, background: "rgba(148,163,184,.22)", borderRadius: 999 }}>
      <div
        style={{
          height: 10,
          width: `${weightedPercent}%`,
          background: "var(--accent)",
          borderRadius: 999,
          transition: "width .2s ease",
        }}
      />
    </div>
  </div>
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

        <div style={{ marginTop: 16 }}>
          <ScoreSheet
            progress={progress}
            onToggle={toggleCell}
            onReset={resetProgress}
            showWin={showWin}
            onCloseWin={() => setShowWin(false)}
            headerRight={null}
          />
        </div>

        <p style={{ marginTop: 14, color: "var(--muted)" }}>
          Dela koden <b>{roomCode.toUpperCase()}</b> så kan andra ansluta.
        </p>
      </Card>

      {/* Settings modal */}
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
                <Button variant="ghost" onClick={() => setShowSettings(false)}>
                  Stäng
                </Button>
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
                    <Button variant="danger" onClick={handleLeave}>
                      Lämna lobby
                    </Button>
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

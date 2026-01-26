import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { leaveRoom } from "./services/leave";
import { touchPlayer } from "./services/presence";
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

export default function App() {
  const [deviceId] = useState(() => getOrCreateDeviceId());

  const [step, setStep] = useState("home"); // home | room
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState([]);

  // Force re-render each second so Online/Pausad updates smoothly
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-restore: if user accidentally closes app, come back to same room/player
  useEffect(() => {
    const savedCode = localStorage.getItem("scoreboard_room_code");
    const savedRoomId = localStorage.getItem("scoreboard_room_id");
    const savedPlayerId = localStorage.getItem("scoreboard_player_id");

    if (savedCode && savedRoomId && savedPlayerId) {
      setRoomCode(savedCode);
      setRoomId(savedRoomId);
      setPlayerId(savedPlayerId);
      setStep("room");
    }
  }, []);

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

    // Try to re-use existing player for this device in this room
    let player = null;
    const { data: existing, error: existingErr } = await getPlayerByDevice(room.id, deviceId);

    if (!existingErr && existing) {
      player = existing;

      // Optional: update name if user typed a new one
      if (playerName && playerName !== player.name) {
        await supabase.from("players").update({ name: playerName }).eq("id", player.id);
        player = { ...player, name: playerName };
      }
    } else {
      // Otherwise create a new player tied to deviceId
      const { data: created, error: playerErr } = await createPlayer(room.id, playerName, deviceId);
      if (playerErr) return alert(playerErr.message);
      player = created;
    }

    // Ensure score row exists (no duplicates)
    const { error: scoreErr } = await ensureScore(room.id, player.id);
    if (scoreErr) return alert(scoreErr.message);

    // Persist session for auto-restore
    localStorage.setItem("scoreboard_room_code", code);
    localStorage.setItem("scoreboard_room_id", room.id);
    localStorage.setItem("scoreboard_player_id", player.id);

    setRoomCode(code);
    setRoomId(room.id);
    setPlayerId(player.id);
    setStep("room");
  }

  async function loadRoomState(rid) {
    const { data: ps, error: pe } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", rid)
      .order("joined_at");
    if (pe) console.error(pe);
    setPlayers(ps ?? []);

    const { data: sc, error: se } = await supabase.from("scores").select("*").eq("room_id", rid);
    if (se) console.error(se);
    setScores(sc ?? []);
  }

  async function changeMyScore(delta) {
    if (!roomId || !playerId) return;

    const current = scores.find((s) => s.player_id === playerId)?.score ?? 0;
    const next = current + delta;

    const { error } = await supabase
      .from("scores")
      .update({ score: next, updated_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("player_id", playerId);

    if (error) alert(error.message);
  }

  async function handleLeave() {
    try {
      await leaveRoom(roomId, playerId);
    } finally {
      // Clear auto-restore so user truly leaves
      localStorage.removeItem("scoreboard_room_code");
      localStorage.removeItem("scoreboard_room_id");
      localStorage.removeItem("scoreboard_player_id");

      window.location.reload();
    }
  }

  useEffect(() => {
    if (!roomId || !playerId) return;

    loadRoomState(roomId);

    // Heartbeat: update last_seen while visible; pause in background (iOS friendly)
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
        if (!heartbeatId) {
          heartbeatId = setInterval(() => touchPlayer(playerId), 5 * 1000);
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `room_id=eq.${roomId}` },
        () => loadRoomState(roomId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        () => loadRoomState(roomId)
      )
      .subscribe();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (heartbeatId) clearInterval(heartbeatId);
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId]);

  const scoreRows = useMemo(() => {
    const byPlayer = new Map(scores.map((s) => [s.player_id, s.score]));
    const onlineCutoffMs = 20 * 1000;

    return players
      .map((p) => {
        const lastSeenMs = p.last_seen ? new Date(p.last_seen).getTime() : 0;
        const ageMs = lastSeenMs ? Date.now() - lastSeenMs : Number.POSITIVE_INFINITY;
        const status = ageMs <= onlineCutoffMs ? "Online" : "Pausad";

        return {
          id: p.id,
          name: p.name,
          score: byPlayer.get(p.id) ?? 0,
          status,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [players, scores]);

  if (step === "home") {
    return (
      <div style={{ maxWidth: 520, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
        <h1>Scoreboard (PWA)</h1>

        <label style={{ display: "block", marginTop: 12 }}>
          Ditt namn
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          Rumskod (för att joina)
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="t.ex. A1B2C3"
            style={{ width: "100%", padding: 10, marginTop: 6, textTransform: "uppercase" }}
          />
        </label>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button onClick={createRoom} style={{ padding: 12, flex: 1 }}>
            Skapa rum
          </button>
          <button onClick={() => joinRoom()} disabled={!canJoin} style={{ padding: 12, flex: 1 }}>
            Joina rum
          </button>
        </div>

        <p style={{ marginTop: 18, opacity: 0.8 }}>
          Skapa rum → dela rumskoden → alla ser live-ställningen.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2>Rum: {roomCode.toUpperCase()}</h2>
        <button onClick={handleLeave} style={{ padding: 10 }}>
          Lämna
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, margin: "12px 0 18px" }}>
        <button onClick={() => changeMyScore(-1)} style={{ padding: 12, flex: 1 }}>
          -1
        </button>
        <button onClick={() => changeMyScore(+1)} style={{ padding: 12, flex: 1 }}>
          +1
        </button>
        <button onClick={() => changeMyScore(+5)} style={{ padding: 12, flex: 1 }}>
          +5
        </button>
      </div>

      <h3>Ställning</h3>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        {scoreRows.map((r, idx) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderTop: idx === 0 ? "none" : "1px solid #eee",
              fontWeight: r.id === playerId ? 700 : 400,
            }}
          >
            <span>
              {idx + 1}. {r.name}{" "}
              <span style={{ opacity: 0.7, fontWeight: 400 }}>({r.status})</span>
            </span>
            <span>{r.score}</span>
          </div>
        ))}
        {scoreRows.length === 0 && <div style={{ padding: 12 }}>Väntar på spelare...</div>}
      </div>

      <p style={{ marginTop: 14, opacity: 0.8 }}>
        Dela rumskoden <b>{roomCode.toUpperCase()}</b> så kan andra joina.
      </p>
    </div>
  );
}

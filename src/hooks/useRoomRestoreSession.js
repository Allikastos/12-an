import { useEffect } from "react";
import { supabase } from "../supabase";
import { ensureScore, getPlayerByDevice, getRoomByCode } from "../services/rooms";

export function useRoomRestoreSession({
  deviceId,
  name,
  setName,
  setRoomCode,
  setRoomId,
  setPlayerId,
  setStep,
  setSelectedPlayMode,
}) {
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const savedCode = localStorage.getItem("scoreboard_room_code");
      const savedRoomId = localStorage.getItem("scoreboard_room_id");
      const savedPlayerId = localStorage.getItem("scoreboard_player_id");
      const savedStep = localStorage.getItem("scoreboard_step");

      if (!savedCode || !savedRoomId || !savedPlayerId) return;

      const { data: room, error: roomErr } = await getRoomByCode(savedCode);
      if (roomErr || !room) {
        localStorage.removeItem("scoreboard_room_code");
        localStorage.removeItem("scoreboard_room_id");
        localStorage.removeItem("scoreboard_player_id");
        localStorage.removeItem("scoreboard_step");
        return;
      }

      const { data: existing } = await getPlayerByDevice(room.id, deviceId);

      let player = existing ?? null;
      if (!player) {
        const { data: persisted } = await supabase
          .from("players")
          .select("*")
          .eq("id", savedPlayerId)
          .eq("room_id", room.id)
          .maybeSingle();
        player = persisted ?? null;
      }

      if (!player) {
        localStorage.removeItem("scoreboard_room_code");
        localStorage.removeItem("scoreboard_room_id");
        localStorage.removeItem("scoreboard_player_id");
        localStorage.removeItem("scoreboard_step");
        return;
      }

      await ensureScore(room.id, player.id);

      const { data: roomState } = await supabase
        .from("room_state")
        .select("round_counts")
        .eq("room_id", room.id)
        .maybeSingle();

      const restoredStep =
        savedStep === "canasta" ||
        Boolean(roomState?.round_counts?.__canasta_mode || roomState?.round_counts?.__canasta_match)
          ? "canasta"
          : savedStep === "gin" ||
            roomState?.round_counts?.__game_type === "gin" ||
            Boolean(roomState?.round_counts?.__gin_match)
          ? "gin"
          : "room";

      if (cancelled) return;

      setRoomCode(savedCode);
      setRoomId(room.id);
      setPlayerId(player.id);
      if (!name && player.name) setName(player.name);
      if (restoredStep === "canasta") {
        setSelectedPlayMode?.("canasta");
      } else if (restoredStep === "gin") {
        setSelectedPlayMode?.("gin");
      }
      setStep(restoredStep);

      localStorage.setItem("scoreboard_room_code", savedCode);
      localStorage.setItem("scoreboard_room_id", room.id);
      localStorage.setItem("scoreboard_player_id", player.id);
      localStorage.setItem("scoreboard_step", restoredStep);
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [deviceId, name, setName, setPlayerId, setRoomCode, setRoomId, setStep, setSelectedPlayMode]);
}

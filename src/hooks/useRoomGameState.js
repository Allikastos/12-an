import { useCallback, useEffect } from "react";
import { supabase } from "../supabase";
import { touchPlayer } from "../services/presence";

export function useRoomGameState({ roomId, playerId, setRoomState, rematchSupportedRef }) {
  const stripRematchVotes = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return payload;
    if (!Object.prototype.hasOwnProperty.call(payload, "rematch_votes")) return payload;
    const { rematch_votes: _rematchVotes, ...rest } = payload;
    return rest;
  }, []);

  const isRematchColumnError = useCallback((error) => {
    const msg = error?.message ?? "";
    return msg.includes("rematch_votes") || msg.includes("schema cache");
  }, []);

  const upsertRoomStateSafe = useCallback(async (payload, options) => {
    const base = rematchSupportedRef.current ? payload : stripRematchVotes(payload);
    let result = await supabase.from("room_state").upsert(base, options).select("*").single();
    if (result.error && rematchSupportedRef.current && isRematchColumnError(result.error)) {
      rematchSupportedRef.current = false;
      result = await supabase
        .from("room_state")
        .upsert(stripRematchVotes(payload), options)
        .select("*")
        .single();
    }
    return result;
  }, [rematchSupportedRef, stripRematchVotes, isRematchColumnError]);

  const updateRoomStateSafe = useCallback(async (payload) => {
    const base = rematchSupportedRef.current ? payload : stripRematchVotes(payload);
    let result = await supabase
      .from("room_state")
      .update(base)
      .eq("room_id", roomId)
      .select("*")
      .single();
    if (result.error && rematchSupportedRef.current && isRematchColumnError(result.error)) {
      rematchSupportedRef.current = false;
      result = await supabase
        .from("room_state")
        .update(stripRematchVotes(payload))
        .eq("room_id", roomId)
        .select("*")
        .single();
    }
    return result;
  }, [rematchSupportedRef, roomId, stripRematchVotes, isRematchColumnError]);

  const insertRoomStateSafe = useCallback(async (payload) => {
    const base = rematchSupportedRef.current ? payload : stripRematchVotes(payload);
    let result = await supabase.from("room_state").insert([base]).select("*").single();
    if (result.error && rematchSupportedRef.current && isRematchColumnError(result.error)) {
      rematchSupportedRef.current = false;
      result = await supabase
        .from("room_state")
        .insert([stripRematchVotes(payload)])
        .select("*")
        .single();
    }
    return result;
  }, [rematchSupportedRef, stripRematchVotes, isRematchColumnError]);

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

  useEffect(() => {
    if (!roomId || !playerId) return;

    async function ensureRoomState() {
      const { data: existing } = await supabase
        .from("room_state")
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();

      if (!existing) {
        const { data: created } = await insertRoomStateSafe({
          room_id: roomId,
          host_player_id: playerId,
          started: false,
          turn_player_id: null,
          turn_order: [],
          round_counts: {},
          finish_triggered: false,
          finish_until_player_id: null,
          finish_until_round: null,
          finish_winner_ids: [],
          rematch_votes: {},
          match_id: null,
          finalized_at: null,
          updated_at: new Date().toISOString(),
        });
        setRoomState(created ?? null);
      } else {
        if (!Object.prototype.hasOwnProperty.call(existing, "rematch_votes")) {
          rematchSupportedRef.current = false;
        }
        if (!existing.host_player_id) {
          const { data: updated } = await updateRoomStateSafe({
            host_player_id: playerId,
            updated_at: new Date().toISOString(),
          });
          setRoomState(updated ?? existing);
          return;
        }
        setRoomState(existing);
      }
    }

    ensureRoomState();
  }, [roomId, playerId, insertRoomStateSafe, updateRoomStateSafe, setRoomState, rematchSupportedRef]);

  return {
    upsertRoomStateSafe,
    updateRoomStateSafe,
    insertRoomStateSafe,
  };
}

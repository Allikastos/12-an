import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

export function useRoomRealtime({ roomId, setRoomState, loadChat, handleIncomingMessage }) {
  const [players, setPlayers] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);

  const loadPlayers = useCallback(async (room) => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room)
      .order("joined_at");
    setPlayers(data ?? []);
  }, []);

  const loadRoomState = useCallback(async (room) => {
    const { data } = await supabase
      .from("room_state")
      .select("*")
      .eq("room_id", room)
      .maybeSingle();
    setRoomState(data ?? null);
  }, [setRoomState]);

  const loadPlayerStates = useCallback(async (room) => {
    const { data } = await supabase
      .from("player_state")
      .select("*")
      .eq("room_id", room);
    setPlayerStates(data ?? []);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    queueMicrotask(() => {
      void loadPlayers(roomId);
      void loadRoomState(roomId);
      void loadPlayerStates(roomId);
      void loadChat(roomId);
    });

    const pollId = setInterval(() => {
      void loadPlayers(roomId);
      void loadRoomState(roomId);
      void loadPlayerStates(roomId);
      void loadChat(roomId);
    }, 3000);

    const onFocus = () => {
      void loadPlayers(roomId);
      void loadRoomState(roomId);
      void loadPlayerStates(roomId);
      void loadChat(roomId);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase
      .channel(`room:${roomId}:state`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        () => loadPlayers(roomId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_state", filter: `room_id=eq.${roomId}` },
        () => loadRoomState(roomId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_state", filter: `room_id=eq.${roomId}` },
        () => loadPlayerStates(roomId)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          handleIncomingMessage(payload.new);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [roomId, loadPlayers, loadRoomState, loadPlayerStates, loadChat, handleIncomingMessage]);

  return {
    players,
    playerStates,
  };
}

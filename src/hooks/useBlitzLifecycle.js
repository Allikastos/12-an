import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { formatCountdown, getDateKeySweden, getNextBlitzTimes } from "../lib/appUtils";

export function useBlitzLifecycle() {
  const [blitzEvent, setBlitzEvent] = useState(null);
  const [blitzParticipants, setBlitzParticipants] = useState([]);
  const [blitzNowState, setBlitzNowState] = useState(new Date());
  const blitzAutoStartRef = useRef({ dateKey: null, lastAttempt: 0 });
  const blitzBootstrapRef = useRef({ dateKey: null, lastAttempt: 0 });

  const loadBlitzParticipants = useCallback(async (eventId) => {
    if (!eventId) {
      setBlitzParticipants([]);
      return;
    }
    const { data } = await supabase
      .from("blitz_participants")
      .select("id, profile_id, player_id, status, eliminated_at, eliminated_seq")
      .eq("event_id", eventId);
    setBlitzParticipants(data ?? []);
  }, []);

  const loadBlitzEvent = useCallback(async () => {
    const now = new Date();
    const todayKey = getDateKeySweden(now);
    const times = getNextBlitzTimes(now);
    let { data: event } = await supabase
      .from("blitz_events")
      .select("*")
      .eq("date_key", todayKey)
      .maybeSingle();
    if (!event && now >= times.start) {
      event = null;
    }
    setBlitzEvent(event);
    if (event?.id) await loadBlitzParticipants(event.id);
    return event;
  }, [loadBlitzParticipants]);

  const ensureBlitzEvent = useCallback(async () => {
    const now = new Date();
    const times = getNextBlitzTimes(now);
    if (now < times.lobby) return blitzEvent ?? null;
    try {
      await supabase.functions.invoke("blitz-bootstrap");
    } catch {
      // Ignore, fallback to load from DB
    }
    return await loadBlitzEvent();
  }, [blitzEvent, loadBlitzEvent]);

  const maybeBootstrapBlitz = useCallback(async (now) => {
    const times = getNextBlitzTimes(now);
    if (now < times.lobby) return;
    const dateKey = getDateKeySweden(now);
    if (blitzEvent?.date_key === dateKey && blitzEvent?.room_id) return;
    const last = blitzBootstrapRef.current;
    if (last?.dateKey === dateKey && now.getTime() - (last?.lastAttempt ?? 0) < 60000) return;
    blitzBootstrapRef.current = { dateKey, lastAttempt: now.getTime() };
    await ensureBlitzEvent();
  }, [blitzEvent?.date_key, blitzEvent?.room_id, ensureBlitzEvent]);

  const maybeAutoStartBlitz = useCallback(async (event, now) => {
    if (!event?.id || event.status !== "lobby") return;
    const startAt = event.start_at ? new Date(event.start_at) : getNextBlitzTimes(now).start;
    if (now < startAt) return;

    const dateKey = event.date_key ?? getDateKeySweden(now);
    const last = blitzAutoStartRef.current;
    if (last?.dateKey === dateKey && now.getTime() - (last?.lastAttempt ?? 0) < 60000) return;

    blitzAutoStartRef.current = { dateKey, lastAttempt: now.getTime() };
    try {
      await supabase.functions.invoke("blitz-start");
      await loadBlitzEvent();
    } catch (err) {
      console.error("blitz-start fallback failed", err);
    }
  }, [loadBlitzEvent]);

  const blitzTimes = (() => {
    if (blitzEvent?.start_at && blitzEvent?.lobby_open_at) {
      return {
        start: new Date(blitzEvent.start_at),
        lobby: new Date(blitzEvent.lobby_open_at),
      };
    }
    return getNextBlitzTimes();
  })();

  const blitzNow = blitzNowState;
  const blitzLobbyOpen = blitzNow >= blitzTimes.lobby && blitzNow < blitzTimes.start;
  const blitzStartsIn = formatCountdown(blitzTimes.start.getTime() - blitzNow.getTime());
  const blitzRunning = blitzEvent?.status === "running";
  const blitzFinished = blitzEvent?.status === "finished";
  const blitzElimIn = (() => {
    if (!blitzRunning || !blitzEvent?.next_elim_at) return null;
    const nextElim = new Date(blitzEvent.next_elim_at);
    const diff = nextElim.getTime() - blitzNowState.getTime();
    return formatCountdown(diff);
  })();

  useEffect(() => {
    queueMicrotask(() => {
      void loadBlitzEvent();
    });
    const id = setInterval(() => loadBlitzEvent(), 5000);
    const onFocus = () => loadBlitzEvent();
    const onVisible = () => {
      if (document.visibilityState === "visible") loadBlitzEvent();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadBlitzEvent]);

  useEffect(() => {
    if (!blitzEvent?.id) return;
    const channel = supabase
      .channel(`blitz:${blitzEvent.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blitz_events", filter: `id=eq.${blitzEvent.id}` },
        () => loadBlitzEvent()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blitz_participants",
          filter: `event_id=eq.${blitzEvent.id}`,
        },
        () => loadBlitzParticipants(blitzEvent.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [blitzEvent?.id, loadBlitzEvent, loadBlitzParticipants]);

  useEffect(() => {
    if (!blitzEvent?.id || blitzEvent.status !== "lobby") return;
    const now = new Date();
    queueMicrotask(() => {
      void maybeAutoStartBlitz(blitzEvent, now);
    });
  }, [blitzEvent, maybeAutoStartBlitz]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setBlitzNowState(now);
      if (blitzEvent?.status === "lobby") {
        void maybeAutoStartBlitz(blitzEvent, now);
      }
      if (!blitzEvent?.id || !blitzEvent?.room_id) {
        void maybeBootstrapBlitz(now);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [blitzEvent, maybeAutoStartBlitz, maybeBootstrapBlitz]);

  return {
    blitzEvent,
    blitzParticipants,
    blitzNow,
    blitzLobbyOpen,
    blitzStartsIn,
    blitzRunning,
    blitzFinished,
    blitzElimIn,
    loadBlitzParticipants,
    loadBlitzEvent,
    ensureBlitzEvent,
  };
}

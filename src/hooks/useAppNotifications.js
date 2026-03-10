import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { urlBase64ToUint8Array } from "../lib/appUtils";

export function useAppNotifications({
  userId,
  settings,
  setSettings,
  roomState,
  playerId,
  roomInvites,
}) {
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const lastTurnNotifiedRef = useRef(null);
  const prevTurnPlayerRef = useRef(null);
  const seenInviteIdsRef = useRef(new Set());

  const ensureBrowserNotifications = useCallback(async (offKey) => {
    if (!("Notification" in window)) {
      alert("Notiser stöds inte i denna webbläsare.");
      return false;
    }
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        if (offKey) setSettings((s) => ({ ...s, [offKey]: false }));
        return false;
      }
    }
    return true;
  }, [setSettings]);

  const registerBlitzPush = useCallback(async () => {
    if (!userId) return;
    if (!("serviceWorker" in navigator)) return;
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!publicKey) return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const json = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh ?? "";
    const auth = json.keys?.auth ?? "";
    if (!endpoint || !p256dh || !auth) return;
    await supabase.from("push_subscriptions").upsert(
      {
        profile_id: userId,
        endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,endpoint" }
    );
  }, [userId]);

  const unregisterBlitzPush = useCallback(async () => {
    if (!userId) return;
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("profile_id", userId)
        .eq("endpoint", sub.endpoint);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const askedKey = "scoreboard_notifs_prompted_v1";
    if (localStorage.getItem(askedKey)) return;
    if (!("Notification" in window)) {
      localStorage.setItem(askedKey, "1");
      return;
    }
    if (Notification.permission === "default") {
      const ok = window.confirm("Vill du slå på notiser?");
      localStorage.setItem(askedKey, "1");
      if (!ok) return;
      (async () => {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
        setSettings((s) => ({ ...s, notifyTurn: true, notifyInvite: true, notifyBlitz: true }));
        await registerBlitzPush();
      })();
    } else {
      localStorage.setItem(askedKey, "1");
    }
  }, [userId, setSettings, registerBlitzPush]);

  useEffect(() => {
    if (!settings.notifyTurn) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!roomState?.turn_player_id) return;
    const prev = prevTurnPlayerRef.current;
    const current = String(roomState.turn_player_id);
    prevTurnPlayerRef.current = current;
    if (String(playerId ?? "") !== current) return;
    if (prev && prev === current) return;
    const key = `${current}:${roomState.updated_at ?? ""}`;
    if (lastTurnNotifiedRef.current === key) return;
    lastTurnNotifiedRef.current = key;
    new Notification("Din tur", { body: "Det är din tur att slå!" });
  }, [roomState?.turn_player_id, roomState?.updated_at, playerId, settings.notifyTurn]);

  useEffect(() => {
    if (!settings.notifyInvite) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const seen = seenInviteIdsRef.current;
    const newInvites = roomInvites.filter((i) => !seen.has(i.id));
    if (newInvites.length === 0) return;
    newInvites.forEach((inv) => seen.add(inv.id));
    const first = newInvites[0];
    const from = first?.sender?.display_name ?? "Spelare";
    new Notification("Rumsinbjudan", { body: `${from} bjöd in dig till ett rum.` });
  }, [roomInvites, settings.notifyInvite]);

  useEffect(() => {
    if (!settings.notifyBlitz) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    void registerBlitzPush();
  }, [settings.notifyBlitz, registerBlitzPush]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(display-mode: standalone)");
    const update = () => {
      const standalone =
        Boolean(media && media.matches) ||
        window.navigator.standalone === true ||
        document.referrer.startsWith("android-app://");
      setIsStandalone(standalone);
    };
    update();
    media?.addEventListener?.("change", update);
    return () => media?.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const qp = new URLSearchParams(window.location.search);
    if (qp.get("swReset") !== "1") return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("swReset");
        window.location.replace(url.toString());
      });
  }, []);

  const toggleNotifyTurn = useCallback(async () => {
    const ok = await ensureBrowserNotifications("notifyTurn");
    if (!ok) return;
    setSettings((s) => ({ ...s, notifyTurn: !s.notifyTurn }));
  }, [ensureBrowserNotifications, setSettings]);

  const toggleNotifyInvite = useCallback(async () => {
    const ok = await ensureBrowserNotifications("notifyInvite");
    if (!ok) return;
    setSettings((s) => ({ ...s, notifyInvite: !s.notifyInvite }));
  }, [ensureBrowserNotifications, setSettings]);

  const toggleNotifyBlitz = useCallback(async () => {
    const ok = await ensureBrowserNotifications("notifyBlitz");
    if (!ok) return;
    const next = !settings.notifyBlitz;
    setSettings((s) => ({ ...s, notifyBlitz: next }));
    if (next) {
      await registerBlitzPush();
    } else {
      await unregisterBlitzPush();
    }
  }, [ensureBrowserNotifications, settings.notifyBlitz, setSettings, registerBlitzPush, unregisterBlitzPush]);

  const installAsApp = useCallback(async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  return {
    showInstallHelp,
    setShowInstallHelp,
    installPrompt,
    isStandalone,
    toggleNotifyTurn,
    toggleNotifyInvite,
    toggleNotifyBlitz,
    registerBlitzPush,
    unregisterBlitzPush,
    installAsApp,
  };
}

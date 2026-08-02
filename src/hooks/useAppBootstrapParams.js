import { useEffect, useRef } from "react";
import { writeHarpanWins } from "../lib/harpanProgress";

export function useAppBootstrapParams({
  sanitizeRoomCode,
  setRoomCode,
  setSelectedPlayMode = null,
  themes,
  applyTheme,
  setAuthNotice,
}) {
  const themePreviewAppliedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedCode = params.get("room");
    const sharedGame = params.get("game");
    if (sharedCode) setRoomCode(sanitizeRoomCode(sharedCode));
    if (sharedGame === "canasta" && typeof setSelectedPlayMode === "function") {
      setSelectedPlayMode("canasta");
    } else if (sharedGame === "gin" && typeof setSelectedPlayMode === "function") {
      setSelectedPlayMode("gin");
    }
  }, [sanitizeRoomCode, setRoomCode, setSelectedPlayMode]);

  useEffect(() => {
    if (themePreviewAppliedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const winsParam = params.get("harpanwins");
    const previewTheme = params.get("theme");

    if (winsParam != null) {
      const winsValue = Number(winsParam);
      if (Number.isFinite(winsValue)) {
        writeHarpanWins(Math.max(0, Math.floor(winsValue)));
      }
    }

    if (!previewTheme || themes.length === 0) return;
    const match = themes.find(
      (theme) =>
        (theme.key ?? "").toLowerCase() === previewTheme.toLowerCase() ||
        (theme.name ?? "").toLowerCase() === previewTheme.toLowerCase()
    );
    if (match) {
      applyTheme(match);
    }
    themePreviewAppliedRef.current = true;
    params.delete("theme");
    params.delete("harpanwins");
    const next = params.toString();
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, [themes, applyTheme]);

  useEffect(() => {
    const hash = window.location.hash ?? "";
    if (!hash) return;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const errorDesc = params.get("error_description");
    if (type === "signup" && accessToken) {
      setAuthNotice("E-post bekräftad. Du är nu inloggad.");
    } else if (errorDesc) {
      setAuthNotice(decodeURIComponent(errorDesc));
    }
    if (accessToken || errorDesc) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
  }, [setAuthNotice]);
}

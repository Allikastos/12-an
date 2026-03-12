import { useEffect } from "react";
import { BG_PATTERNS, normalizePatternKey } from "../config/themes";

export function useSettingsEffects({ settings, setSettings }) {
  useEffect(() => {
    localStorage.setItem("scoreboard_settings_v1", JSON.stringify(settings));
    const root = document.documentElement;
    if (settings.bgColor) root.style.setProperty("--bg", settings.bgColor);
    if (settings.accentColor) root.style.setProperty("--accent", settings.accentColor);
    if (settings.bgGlow1) root.style.setProperty("--bg-glow-1", settings.bgGlow1);
    if (settings.bgGlow2) root.style.setProperty("--bg-glow-2", settings.bgGlow2);
    const patternKey = normalizePatternKey(settings.bgPattern);
    if (patternKey !== settings.bgPattern) {
      setSettings((s) => ({ ...s, bgPattern: patternKey }));
      return;
    }
    const pattern = BG_PATTERNS[patternKey] ?? BG_PATTERNS.none;
    root.style.setProperty("--bg-pattern", pattern.image);
    root.style.setProperty("--bg-pattern-size", pattern.size);
    root.style.setProperty("--bg-pattern-repeat", pattern.repeat ?? "repeat");
    root.style.setProperty("--bg-pattern-position", pattern.position ?? "0 0");
    root.style.setProperty("--bg-pattern-opacity", String(settings.bgPatternOpacity ?? 0.25));
    document.body.dataset.theme = patternKey === "none" ? "custom" : patternKey;
    if (settings.diceBg) root.style.setProperty("--dice-bg", settings.diceBg);
    if (settings.dicePip) root.style.setProperty("--dice-pip", settings.dicePip);
    if (settings.diceBorder) root.style.setProperty("--dice-border", settings.diceBorder);
    if (settings.diceLocked) root.style.setProperty("--dice-locked", settings.diceLocked);
    if (settings.dicePipLocked) root.style.setProperty("--dice-pip-locked", settings.dicePipLocked);
    if (settings.btnPrimaryBg) root.style.setProperty("--btn-primary-bg", settings.btnPrimaryBg);
    if (settings.btnPrimaryText) root.style.setProperty("--btn-primary-text", settings.btnPrimaryText);
    if (settings.btnPrimaryBorder) root.style.setProperty("--btn-primary-border", settings.btnPrimaryBorder);
    if (settings.btnPrimaryShadow) root.style.setProperty("--btn-primary-shadow", settings.btnPrimaryShadow);
  }, [settings, setSettings]);

  useEffect(() => {
    if (settings.themeKey === "Aurora") {
      setSettings((s) => ({ ...s, themeKey: "Galax" }));
      return;
    }
    if (
      settings.themeKey === "Phantom Ghost" ||
      settings.themeKey === "Phantom Void" ||
      settings.themeKey === "Phantom Noir"
    ) {
      setSettings((s) => ({ ...s, themeKey: "Ghost" }));
      return;
    }
    if (!settings.themeKey) {
      setSettings((s) => ({ ...s, themeKey: "Standard" }));
    }
  }, [settings.themeKey, setSettings]);

  useEffect(() => {
    if (typeof settings.turnNotifications === "boolean" && typeof settings.notifyTurn !== "boolean") {
      setSettings((s) => ({ ...s, notifyTurn: s.turnNotifications }));
    }
  }, [settings.turnNotifications, settings.notifyTurn, setSettings]);
}

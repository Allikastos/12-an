import { useCallback, useEffect, useMemo } from "react";
import { THEMES } from "../config/themes";
import { UNLOCK_KING_FOR_PREVIEW } from "../lib/appUtils";

// Keep this false in normal gameplay so theme unlock rules are enforced.
const FORCE_UNLOCK_ALL_THEMES_PREVIEW = false;

export function useThemeManager({
  settings,
  setSettings,
  isKingReady,
  isKing,
  stats,
  user,
  personalThemeName,
  setPersonalThemeName,
}) {
  const themes = THEMES;
  const kingLocked = isKingReady && !isKing && !UNLOCK_KING_FOR_PREVIEW;
  const themeLockMap = useMemo(() => {
    const map = new Map();
    themes.forEach((theme) => {
      const key = theme.key ?? theme.name;
      let locked = false;
      let reason = "";

      if (FORCE_UNLOCK_ALL_THEMES_PREVIEW) {
        map.set(key, { locked: false, reason: "" });
        return;
      }

      if (theme.requiresKing && !isKing && !UNLOCK_KING_FOR_PREVIEW) {
        locked = true;
        reason = "Bli King of the Month";
      }

      if (!locked && theme.unlock) {
        const metric = theme.unlock.metric;
        const need = Number(theme.unlock.value ?? 0);
        const value = Number(stats?.[metric] ?? 0);
        if (value < need) {
          locked = true;
          reason = theme.unlock.label ?? "Lås upp genom att spela";
        }
      }

      map.set(key, { locked, reason });
    });
    return map;
  }, [themes, isKing, stats]);

  const isThemeLocked = useCallback(
    (theme) => {
      const key = theme?.key ?? theme?.name;
      if (!key) return false;
      return Boolean(themeLockMap.get(key)?.locked);
    },
    [themeLockMap]
  );

  const getThemeLockReason = useCallback(
    (theme) => {
      const key = theme?.key ?? theme?.name;
      if (!key) return "";
      return themeLockMap.get(key)?.reason ?? "";
    },
    [themeLockMap]
  );

  const themeSnapshot = useMemo(
    () => ({
      boxSize: settings.boxSize,
      rowCompleteBg: settings.rowCompleteBg,
      checkColor: settings.checkColor,
      ringColors: settings.ringColors,
      buttonIcon: settings.buttonIcon,
      filledRingColor: settings.filledRingColor,
      checkShape: settings.checkShape,
      cellStyle: settings.cellStyle,
      diceStyle: settings.diceStyle,
      diceBg: settings.diceBg,
      dicePip: settings.dicePip,
      diceBorder: settings.diceBorder,
      diceLocked: settings.diceLocked,
      dicePipLocked: settings.dicePipLocked,
    }),
    [
      settings.boxSize,
      settings.rowCompleteBg,
      settings.checkColor,
      settings.ringColors,
      settings.buttonIcon,
      settings.filledRingColor,
      settings.checkShape,
      settings.cellStyle,
      settings.diceStyle,
      settings.diceBg,
      settings.dicePip,
      settings.diceBorder,
      settings.diceLocked,
      settings.dicePipLocked,
    ]
  );

  const applyTheme = useCallback(
    (theme) => {
      if (isThemeLocked(theme)) return;
      setSettings((s) => ({
        ...s,
        themeKey: theme.key ?? theme.name,
        bgColor: theme.bgColor,
        accentColor: theme.accentColor,
        checkColor: theme.checkColor ?? theme.accentColor,
        rowCompleteBg: theme.rowCompleteBg,
        bgGlow1: theme.bgGlow1,
        bgGlow2: theme.bgGlow2,
        bgPattern: theme.bgPattern ?? "none",
        bgPatternOpacity: theme.bgPatternOpacity ?? 0.25,
        diceBg: theme.diceBg,
        dicePip: theme.dicePip,
        diceBorder: theme.diceBorder,
        diceLocked: theme.diceLocked,
        dicePipLocked: theme.dicePipLocked,
        btnPrimaryBg: theme.btnPrimaryBg,
        btnPrimaryText: theme.btnPrimaryText,
        btnPrimaryBorder: theme.btnPrimaryBorder,
        btnPrimaryShadow: theme.btnPrimaryShadow,
        ringColorMode: theme.ringColorMode ?? "none",
        ringColors: theme.ringColors ?? null,
        buttonIcon: theme.buttonIcon ?? "",
        filledRingColor: theme.filledRingColor ?? theme.accentColor ?? s.filledRingColor,
        checkShape: theme.checkShape ?? "circle",
        cellStyle: theme.cellStyle ?? "ring",
        personalThemeId: null,
      }));
    },
    [setSettings, isThemeLocked]
  );

  const applyPersonalTheme = useCallback(
    (theme) => {
      if (!theme) return;
      setSettings((s) => ({
        ...s,
        ...theme.colors,
        personalThemeId: theme.id,
      }));
    },
    [setSettings]
  );

  const savePersonalTheme = useCallback(() => {
    if (!user) return;
    const nameValue = personalThemeName.trim();
    if (!nameValue) return;
    const id =
      globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `pt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const colors = {
      bgColor: settings.bgColor,
      bgGlow1: settings.bgGlow1,
      bgGlow2: settings.bgGlow2,
      accentColor: settings.accentColor,
      checkColor: settings.checkColor,
      rowCompleteBg: settings.rowCompleteBg,
      bgPattern: settings.bgPattern,
      bgPatternOpacity: settings.bgPatternOpacity,
      diceBg: settings.diceBg,
      dicePip: settings.dicePip,
      diceBorder: settings.diceBorder,
      diceLocked: settings.diceLocked,
      dicePipLocked: settings.dicePipLocked,
      btnPrimaryBg: settings.btnPrimaryBg,
      btnPrimaryText: settings.btnPrimaryText,
      btnPrimaryBorder: settings.btnPrimaryBorder,
      btnPrimaryShadow: settings.btnPrimaryShadow,
      ringColorMode: settings.ringColorMode,
      ringColors: settings.ringColors,
      buttonIcon: settings.buttonIcon,
      filledRingColor: settings.filledRingColor,
    };

    setSettings((s) => ({
      ...s,
      personalThemes: [...(s.personalThemes ?? []), { id, name: nameValue, colors }],
      personalThemeId: id,
    }));
    setPersonalThemeName("");
  }, [user, personalThemeName, settings, setSettings, setPersonalThemeName]);

  const deletePersonalTheme = useCallback(
    (id) => {
      setSettings((s) => {
        const next = (s.personalThemes ?? []).filter((theme) => theme.id !== id);
        return {
          ...s,
          personalThemes: next,
          personalThemeId: s.personalThemeId === id ? null : s.personalThemeId,
        };
      });
    },
    [setSettings]
  );

  useEffect(() => {
    if (!isKingReady) return;
    const currentTheme = themes.find((theme) => (theme.key ?? theme.name) === settings.themeKey);
    if (!currentTheme || isThemeLocked(currentTheme)) {
      const fallback = themes.find((theme) => theme.key === "Standard");
      if (fallback) applyTheme(fallback);
    }
  }, [isKingReady, settings.themeKey, themes, applyTheme, isThemeLocked]);

  useEffect(() => {
    if (!isKingReady) return;
    if (UNLOCK_KING_FOR_PREVIEW) return;
    if (isKing) return;
    const kingOnly = {
      themeKey: settings.themeKey === "King" ? "Standard" : settings.themeKey,
      bgPattern: settings.bgPattern === "royal" ? "none" : settings.bgPattern,
      diceStyle: settings.diceStyle === "king" ? "classic" : settings.diceStyle,
      buttonIcon: settings.buttonIcon === "crown-outline" ? "" : settings.buttonIcon,
    };
    if (
      kingOnly.themeKey !== settings.themeKey ||
      kingOnly.bgPattern !== settings.bgPattern ||
      kingOnly.diceStyle !== settings.diceStyle ||
      kingOnly.buttonIcon !== settings.buttonIcon
    ) {
      setSettings((s) => ({
        ...s,
        themeKey: kingOnly.themeKey,
        bgPattern: kingOnly.bgPattern,
        diceStyle: kingOnly.diceStyle,
        buttonIcon: kingOnly.buttonIcon,
      }));
    }
  }, [
    isKing,
    isKingReady,
    settings.themeKey,
    settings.bgPattern,
    settings.diceStyle,
    settings.buttonIcon,
    setSettings,
  ]);

  return {
    themes,
    kingLocked,
    themeSnapshot,
    applyTheme,
    isThemeLocked,
    getThemeLockReason,
    applyPersonalTheme,
    savePersonalTheme,
    deletePersonalTheme,
  };
}

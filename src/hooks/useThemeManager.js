import { useCallback, useEffect, useMemo, useState } from "react";
import { THEMES } from "../config/themes";
import { UNLOCK_KING_FOR_PREVIEW } from "../lib/appUtils";
import { HARPAN_WINS_EVENT, readHarpanWins } from "../lib/harpanProgress";

// Keep this false in normal gameplay so theme unlock rules are enforced.
const FORCE_UNLOCK_ALL_THEMES_PREVIEW = false;

function resolveThemeProgression(theme, harpanWins) {
  if (!Array.isArray(theme?.progression) || theme.progression.length === 0) return theme;
  const activeStep = [...theme.progression]
    .sort((a, b) => Number(a.wins ?? 0) - Number(b.wins ?? 0))
    .filter((step) => harpanWins >= Number(step.wins ?? 0))
    .at(-1);
  if (!activeStep) return theme;
  return { ...theme, ...activeStep };
}

function themeToSettingsPatch(theme, prevSettings, { keepPersonal = false } = {}) {
  return {
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
    filledRingColor: theme.filledRingColor ?? theme.accentColor ?? prevSettings.filledRingColor,
    checkShape: theme.checkShape ?? "circle",
    cellStyle: theme.cellStyle ?? "ring",
    personalThemeId: keepPersonal ? prevSettings.personalThemeId : null,
  };
}

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
  const [harpanWins, setHarpanWins] = useState(() => readHarpanWins());
  const kingLocked = isKingReady && !isKing && !UNLOCK_KING_FOR_PREVIEW;

  useEffect(() => {
    const refresh = () => setHarpanWins(readHarpanWins());
    const onWinsChanged = (event) => {
      const next = Number(event?.detail);
      setHarpanWins(Number.isFinite(next) ? next : readHarpanWins());
    };
    window.addEventListener(HARPAN_WINS_EVENT, onWinsChanged);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener(HARPAN_WINS_EVENT, onWinsChanged);
      window.removeEventListener("storage", refresh);
    };
  }, []);
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
        const value = metric === "harpanWins" ? harpanWins : Number(stats?.[metric] ?? 0);
        if (value < need) {
          locked = true;
          reason = theme.unlock.label ?? "Lås upp genom att spela";
        }
      }

      map.set(key, { locked, reason });
    });
    return map;
  }, [themes, isKing, stats, harpanWins]);

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
      bgColor: settings.bgColor,
      bgGlow1: settings.bgGlow1,
      bgGlow2: settings.bgGlow2,
      bgPattern: settings.bgPattern,
      bgPatternOpacity: settings.bgPatternOpacity,
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
      settings.bgColor,
      settings.bgGlow1,
      settings.bgGlow2,
      settings.bgPattern,
      settings.bgPatternOpacity,
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
      const resolvedTheme = resolveThemeProgression(theme, harpanWins);
      setSettings((s) => ({
        ...s,
        ...themeToSettingsPatch(resolvedTheme, s),
      }));
    },
    [setSettings, isThemeLocked, harpanWins]
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
    if (settings.themeKey !== "Harpan") return;
    const baseTheme = themes.find((theme) => (theme.key ?? theme.name) === "Harpan");
    if (!baseTheme) return;
    const resolvedTheme = resolveThemeProgression(baseTheme, harpanWins);
    setSettings((s) => {
      if (s.themeKey !== "Harpan") return s;
      const patch = themeToSettingsPatch(resolvedTheme, s, { keepPersonal: true });
      const hasChange = Object.keys(patch).some((key) => patch[key] !== s[key]);
      return hasChange ? { ...s, ...patch } : s;
    });
  }, [settings.themeKey, themes, harpanWins, setSettings]);

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

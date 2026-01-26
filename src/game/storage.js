const KEY = "scoreboard_sheet_v1";
const SETTINGS_KEY = "scoreboard_settings_v1";

export function loadSheet() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSheet(sheet) {
  localStorage.setItem(KEY, JSON.stringify(sheet));
}

export function clearSheet() {
  localStorage.removeItem(KEY);
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

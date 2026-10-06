/**
 * Light / dark / system colour theme.
 * The resolved theme lives on <html data-theme="light|dark">; the tokens in globals.css switch on it.
 * index.html runs the same resolution inline before first paint, so keep the storage key in sync there.
 */
export const COLOR_THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ColorThemePreference = (typeof COLOR_THEME_PREFERENCES)[number];
export type ResolvedColorTheme = 'light' | 'dark';

export const COLOR_THEME_STORAGE_KEY = 'karigar-admin.color-theme';
const COLOR_THEME_CHANGE_EVENT = 'karigar-admin:color-theme-change';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export function readColorThemePreference(): ColorThemePreference {
  try {
    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    return COLOR_THEME_PREFERENCES.find((preference) => preference === stored) ?? 'system';
  } catch {
    return 'system';
  }
}

export function resolveColorTheme(preference: ColorThemePreference): ResolvedColorTheme {
  if (preference !== 'system') return preference;
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
}

function applyResolvedColorTheme(preference: ColorThemePreference) {
  document.documentElement.dataset.theme = resolveColorTheme(preference);
}

export function saveColorThemePreference(preference: ColorThemePreference) {
  try {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked (private mode): the choice lasts until reload.
  }
  applyResolvedColorTheme(preference);
  window.dispatchEvent(new Event(COLOR_THEME_CHANGE_EVENT));
}

/** Notifies on any preference change (this tab, other tabs) and on OS theme changes; re-applies the theme. */
export function subscribeToColorTheme(onChange: () => void): () => void {
  const systemDarkQuery = window.matchMedia(SYSTEM_DARK_QUERY);
  const handleChange = () => {
    applyResolvedColorTheme(readColorThemePreference());
    onChange();
  };
  window.addEventListener(COLOR_THEME_CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleChange);
  systemDarkQuery.addEventListener('change', handleChange);
  return () => {
    window.removeEventListener(COLOR_THEME_CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
    systemDarkQuery.removeEventListener('change', handleChange);
  };
}

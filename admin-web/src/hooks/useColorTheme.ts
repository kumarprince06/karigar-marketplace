import { useSyncExternalStore } from 'react';
import {
  readColorThemePreference,
  resolveColorTheme,
  saveColorThemePreference,
  subscribeToColorTheme,
  type ColorThemePreference,
} from '@/lib/color-theme';

/** Current theme preference and the theme it resolves to; every component using it stays in sync. */
export function useColorTheme() {
  const preference = useSyncExternalStore(subscribeToColorTheme, readColorThemePreference);
  const resolvedTheme = useSyncExternalStore(subscribeToColorTheme, () => resolveColorTheme(preference));
  return {
    preference,
    resolvedTheme,
    setPreference: (nextPreference: ColorThemePreference) => saveColorThemePreference(nextPreference),
  } as const;
}

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useColorTheme } from '@/hooks/useColorTheme';
import type { ColorThemePreference } from '@/lib/color-theme';
import { mergeClassNames } from '@/lib/merge-class-names';

const THEME_OPTIONS: Record<
  ColorThemePreference,
  { label: string; icon: LucideIcon; next: ColorThemePreference }
> = {
  light: { label: 'Light', icon: Sun, next: 'dark' },
  dark: { label: 'Dark', icon: Moon, next: 'system' },
  system: { label: 'System', icon: Monitor, next: 'light' },
};

/** One button that cycles Light → Dark → System; the icon shows the current choice. */
export function ColorThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useColorTheme();
  const current = THEME_OPTIONS[preference];
  const next = THEME_OPTIONS[current.next];
  const accessibleLabel = `Colour theme: ${current.label}. Switch to ${next.label}`;

  return (
    <button
      type="button"
      onClick={() => setPreference(current.next)}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={mergeClassNames(
        'hover:bg-muted text-fg grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg',
        className,
      )}
    >
      <current.icon aria-hidden className="size-5" />
    </button>
  );
}

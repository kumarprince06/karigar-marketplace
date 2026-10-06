import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

interface FilterToggleButtonProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  icon?: LucideIcon;
  children: ReactNode;
}

/** On/off filter chip in a filter bar (".opt" in the mockups). */
export function FilterToggleButton({
  pressed,
  onPressedChange,
  icon: Icon,
  children,
}: FilterToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={mergeClassNames(
        'bg-surface inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md px-3.5 text-[15px]',
        pressed
          ? 'border-primary bg-primary-subtle text-primary border-2 font-semibold'
          : 'border-border-strong border-[1.5px] font-medium',
      )}
    >
      {Icon && <Icon aria-hidden className="size-4" />}
      {children}
    </button>
  );
}

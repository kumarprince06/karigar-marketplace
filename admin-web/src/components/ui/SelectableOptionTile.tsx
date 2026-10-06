import type { ComponentProps, ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

interface SelectableOptionTileProps extends Omit<ComponentProps<'input'>, 'type'> {
  type: 'checkbox' | 'radio';
  children: ReactNode;
}

/** Native checkbox / radio drawn as a selectable tile (the mockups' `.choice .opt`). */
export function SelectableOptionTile({
  type,
  children,
  className,
  disabled,
  ...props
}: SelectableOptionTileProps) {
  return (
    <label
      className={mergeClassNames(
        'border-border-strong bg-surface inline-flex min-h-12 items-center gap-1.5 rounded-md border-[1.5px] px-3.5 py-2 text-[15px] font-medium',
        'has-checked:border-primary has-checked:bg-primary-subtle has-checked:text-primary has-checked:border-2 has-checked:font-semibold',
        'has-focus-visible:shadow-focus',
        disabled ? 'text-fg-subtle cursor-not-allowed border-dashed' : 'cursor-pointer',
        className,
      )}
    >
      <input type={type} disabled={disabled} className="accent-primary size-4 shrink-0" {...props} />
      {children}
    </label>
  );
}

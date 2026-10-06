import type { ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
}

const widths = {
  sm: 'grid-cols-[120px_1fr]',
  md: 'grid-cols-[130px_1fr]',
  lg: 'grid-cols-[150px_1fr]',
} as const;

/** Key/value pairs ("kv" in the mockups). */
export function KeyValueList({
  items,
  labelWidth = 'md',
  className,
}: {
  items: readonly KeyValueItem[];
  labelWidth?: keyof typeof widths;
  className?: string;
}) {
  return (
    <dl
      className={mergeClassNames(
        'grid items-center gap-x-3 gap-y-1.5 text-[13px]',
        widths[labelWidth],
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-fg-muted">{item.label}</dt>
          <dd className="min-w-0">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

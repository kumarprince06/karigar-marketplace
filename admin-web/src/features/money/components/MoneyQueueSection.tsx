import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusChip, type Tone } from '@/components/ui';

interface MoneyQueueSectionProps {
  icon: LucideIcon;
  title: string;
  count: number;
  countTone: Tone;
  /** Right side of the heading: what puts an item in this queue and the permission it needs. */
  rule: ReactNode;
  children: ReactNode;
}

/** One A-05c queue: heading row with item count and entry rule, then its table. */
export function MoneyQueueSection({
  icon: Icon,
  title,
  count,
  countTone,
  rule,
  children,
}: MoneyQueueSectionProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-h4 flex items-center gap-1.5 font-semibold">
          <Icon aria-hidden className="size-5" /> {title}{' '}
          <StatusChip tone={countTone}>
            {count}
            <span className="sr-only"> items</span>
          </StatusChip>
        </h3>
        <p className="text-fg-muted text-[13px]">{rule}</p>
      </header>
      {children}
    </section>
  );
}

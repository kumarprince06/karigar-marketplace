import { Wallet } from 'lucide-react';
import { Card, Money } from '@/components/ui';
import { formatMoney } from '@/lib/formatters';
import { mergeClassNames } from '@/lib/merge-class-names';
import type { BillLine } from '../types';

const lineClassName = 'border-border flex min-h-11 items-center gap-3 border-b px-3.5 py-2 last:border-b-0';

/** Bill so far, exactly as computed by the backend (GET /jobs/{id}/bill). */
export function BillBreakdownCard({ lines }: { lines: readonly BillLine[] }) {
  return (
    <Card padding="none" className="flex-1 gap-0">
      <header className={lineClassName}>
        <h3 className="flex flex-1 items-center gap-1.5 font-bold">
          <Wallet aria-hidden className="size-4" /> Bill so far
        </h3>
        <span className="text-fg-muted text-[13px]">backend-computed</span>
      </header>
      <dl>
        {lines.map((line) => (
          <div key={line.label} className={mergeClassNames(lineClassName, line.isTotal && 'font-bold')}>
            <dt className="flex-1">{line.label}</dt>
            <dd>
              <Money>{formatMoney(line.amount)}</Money>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

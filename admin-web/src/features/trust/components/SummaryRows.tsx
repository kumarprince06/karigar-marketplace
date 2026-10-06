import type { ReactNode } from 'react';

/** Label on the left, value on the right; compact facts inside a card. */
export function SummaryRows({ rows }: { rows: readonly { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-1.5 text-[13px]">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-center justify-between gap-3">
          <dt>{row.label}</dt>
          <dd className="text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

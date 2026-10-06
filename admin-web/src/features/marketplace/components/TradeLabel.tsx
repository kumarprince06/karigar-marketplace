import { TRADE_ICONS } from '../status-display';
import type { Trade } from '../types';

/** Trade icon followed by the job title, e.g. [bolt] "Fan not working". */
export function TradeLabel({ trade, title }: { trade: Trade; title: string }) {
  const TradeIcon = TRADE_ICONS[trade];
  return (
    <span className="inline-flex items-center gap-1.5">
      <TradeIcon aria-hidden className="text-fg-muted size-4 shrink-0" />
      {title}
    </span>
  );
}

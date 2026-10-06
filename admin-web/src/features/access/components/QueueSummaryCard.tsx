import { ArrowLink, Card, IconTile, PermTag, StatusChip } from '@/components/ui';
import { mergeClassNames } from '@/lib/merge-class-names';
import type { OpsQueueSummary } from '../types';

/** One ops queue on the dashboard: count, oldest item age, alert chip and the permission it needs. */
export function QueueSummaryCard({ queue }: { queue: OpsQueueSummary }) {
  const AlertIcon = queue.alertChip.icon;
  return (
    <Card stripe={queue.stripe} className="min-w-0 gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <IconTile icon={queue.icon} tone={queue.iconTone} size="sm" />
        <StatusChip tone={queue.alertChip.tone}>
          {AlertIcon && <AlertIcon aria-hidden className="size-3.5" />}
          {queue.alertChip.label}
        </StatusChip>
      </div>
      <h3 className="font-bold">{queue.title}</h3>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[38px] leading-10 font-extrabold tabular-nums">{queue.count}</span>
        <span className="text-fg-muted text-sm">
          {queue.oldestAge ? (
            <>
              oldest{' '}
              <b className={mergeClassNames(queue.oldestIsOverSla && 'text-error')}>{queue.oldestAge}</b>
              {queue.oldestIsOverSla && <span className="sr-only"> (over SLA)</span>}
            </>
          ) : (
            '—'
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PermTag>
          {queue.viewPermission}
          {queue.permissionNote && ` · ${queue.permissionNote}`}
        </PermTag>
        <ArrowLink to={queue.to}>
          Open<span className="sr-only"> {queue.title}</span>
        </ArrowLink>
      </div>
    </Card>
  );
}

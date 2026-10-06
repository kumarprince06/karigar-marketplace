import { BellRing, ChartLine, ExternalLink, RefreshCw } from 'lucide-react';
import {
  AlertBanner,
  ArrowLink,
  Button,
  buttonVariants,
  Card,
  CopyId,
  DataTable,
  IconTile,
  type Column,
} from '@/components/ui';
import { GRAFANA_URL, paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { formatDateTime } from '@/lib/formatters';
import { DEAD_OUTBOX_EVENTS, DEAD_OUTBOX_SUMMARY } from '../operations-mock-data';
import type { DeadOutboxEvent } from '../types';

const deadEventColumns: Column<DeadOutboxEvent>[] = [
  { id: 'event', header: 'Event', cell: (event) => <CopyId id={event.id} /> },
  {
    id: 'type',
    header: 'Type',
    cell: (event) => <span className="font-mono text-[13px]">{event.eventType}</span>,
  },
  {
    id: 'aggregate',
    header: 'Aggregate',
    cell: (event) => (
      <span className="whitespace-nowrap">
        {event.aggregateType} <CopyId id={event.aggregateId} />
      </span>
    ),
  },
  { id: 'occurred', header: 'Occurred', cell: (event) => formatDateTime(event.occurredAt) },
  { id: 'attempts', header: 'Attempts', cell: (event) => event.attempts },
  {
    id: 'error',
    header: 'Last error',
    cell: (event) => <span className="font-mono text-[13px]">{event.lastError}</span>,
  },
  {
    id: 'actions',
    header: <span className="sr-only">Actions</span>,
    cell: (event) => (
      <RequirePermission permission="ops.act">
        <div className="flex gap-2">
          <Button size="sm">
            Retry<span className="sr-only"> {event.eventType}</span>
          </Button>
          <Button variant="secondary" size="sm">
            Ack…<span className="sr-only"> {event.eventType}</span>
          </Button>
        </div>
      </RequirePermission>
    ),
  },
];

/** A-06e dead outbox events (LLD-022). System health itself lives in Grafana. Payloads are not shown (D8). */
export function OutboxPage() {
  return (
    <>
      <div className="flex flex-col gap-3.5 md:flex-row md:items-stretch">
        <Card variant="brand" className="bg-danger gap-0 p-[18px] md:flex-1">
          <span className="text-sm text-white/90">OUTBOX_DEAD</span>
          <b className="text-[34px] leading-10 tabular-nums">{DEAD_OUTBOX_EVENTS.length}</b>
          <span className="text-sm text-white/90">
            <BellRing aria-hidden className="inline size-4 align-[-3px]" /> alert:{' '}
            {DEAD_OUTBOX_SUMMARY.alertRule} · oldest {DEAD_OUTBOX_SUMMARY.oldestAgeMinutes} min
          </span>
        </Card>
        <Card className="flex-col items-start gap-4 p-[18px] sm:flex-row sm:items-center md:flex-2">
          <IconTile icon={ChartLine} tone="brand" size="illusSm" className="hidden sm:grid" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="text-h4 font-semibold">System health lives in Grafana</h3>
            <span className="text-fg-muted text-sm">
              API latency, error rate, job lag, queue sizes, provider status, DB and Redis. This console only
              shows what staff can act on.
            </span>
          </div>
          <a
            href={GRAFANA_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'accent' })}
          >
            Open Grafana <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Card>
      </div>

      <DataTable
        caption="Dead outbox events"
        columns={deadEventColumns}
        rows={DEAD_OUTBOX_EVENTS}
        rowKey={(event) => event.id}
      />

      <AlertBanner tone="info" icon={RefreshCw}>
        Retry sets DEAD to PENDING with attempts 0. Safe: every consumer is idempotent. Fix the cause first
        (deploy) or it will die again. Ack = &quot;handled elsewhere / no action&quot; + note.
      </AlertBanner>

      <ArrowLink to={paths.ops} className="self-start">
        All ops queues
      </ArrowLink>
    </>
  );
}

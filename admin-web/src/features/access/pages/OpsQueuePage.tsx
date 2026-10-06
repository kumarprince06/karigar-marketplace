import { Check, Compass, X } from 'lucide-react';
import { useParams } from 'react-router';
import {
  AlertBanner,
  Button,
  ButtonLink,
  CopyId,
  DataTable,
  EmptyState,
  StatusChip,
  Tabs,
  type Column,
  type TabItem,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { mergeClassNames } from '@/lib/merge-class-names';
import { AcknowledgeCheckInDialog } from '../components/AcknowledgeCheckInDialog';
import { formatDistance } from '../format-distance';
import {
  FLAGGED_CHECK_INS,
  FLAGGED_CHECK_INS_QUEUE_SLUG,
  OPS_QUEUE_TAB_ORDER,
  TRADE_ICONS,
} from '../mock-data';
import type { FlaggedCheckIn } from '../types';
import { useVisibleOpsQueues } from '../useVisibleOpsQueues';

/** Distances above this are highlighted as far from the address. */
const FAR_DISTANCE_METERS = 500;

/** A-01f Ops queue. Only flagged check-ins live here; the other queues' tabs link to their own pages. */
export function OpsQueuePage() {
  const { queue: queueSlug } = useParams();
  const visibleQueues = useVisibleOpsQueues();
  const { openDialog } = useUrlDialog('acknowledge');

  if (queueSlug !== FLAGGED_CHECK_INS_QUEUE_SLUG) {
    return (
      <EmptyState icon={Compass} title="Unknown queue">
        There is no ops queue called &ldquo;{queueSlug}&rdquo;. Pick one from the ops dashboard.
      </EmptyState>
    );
  }

  const queueTabs: TabItem[] = OPS_QUEUE_TAB_ORDER.flatMap((code) => {
    const queue = visibleQueues.find((visibleQueue) => visibleQueue.code === code);
    return queue
      ? [{ id: code, label: queue.tabTitle, icon: queue.icon, count: queue.count, to: queue.to }]
      : [];
  });

  const columns: readonly Column<FlaggedCheckIn>[] = [
    { id: 'visit', header: 'Visit', cell: (checkIn) => <CopyId id={checkIn.visitId} /> },
    { id: 'booking', header: 'Booking', cell: (checkIn) => <CopyId id={checkIn.bookingId} /> },
    { id: 'worker', header: 'Worker', cell: (checkIn) => checkIn.workerName },
    {
      id: 'trade',
      header: 'Trade',
      cell: (checkIn) => {
        const TradeIcon = TRADE_ICONS[checkIn.trade];
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <TradeIcon aria-hidden className="text-accent-fg size-4" /> {checkIn.trade}
          </span>
        );
      },
    },
    { id: 'check-in', header: 'Check-in', cell: (checkIn) => checkIn.checkedInLabel },
    {
      id: 'distance',
      header: 'Distance · accuracy',
      className: 'whitespace-nowrap',
      cell: (checkIn) => (
        <>
          <b className={mergeClassNames(checkIn.distanceMeters > FAR_DISTANCE_METERS && 'text-error')}>
            {formatDistance(checkIn.distanceMeters)}
          </b>{' '}
          · ±{checkIn.accuracyMeters} m
        </>
      ),
    },
    { id: 'reason', header: "Worker's reason", cell: (checkIn) => checkIn.workerReason },
    {
      id: 'start-code',
      header: 'Start code',
      cell: ({ startCode }) =>
        startCode.status === 'VERIFIED' ? (
          <StatusChip tone="success">
            <Check aria-hidden className="size-3.5" /> Verified {startCode.verifiedAt}
          </StatusChip>
        ) : (
          <StatusChip tone="error">
            <X aria-hidden className="size-3.5" /> Not entered · {startCode.triesUsed}/{startCode.maxTries}{' '}
            tries
          </StatusChip>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      cell: (checkIn) => (
        <div className="flex gap-2">
          <ButtonLink to={paths.booking(checkIn.bookingId)} variant="secondary" size="sm">
            Open<span className="sr-only"> booking</span>
          </ButtonLink>
          <RequirePermission permission="ops.act">
            <Button size="sm" onClick={() => openDialog({ visit: checkIn.visitId })}>
              Acknowledge<span className="sr-only"> check-in by {checkIn.workerName}</span>
            </Button>
          </RequirePermission>
        </div>
      ),
    },
  ];

  return (
    <>
      <Tabs label="Ops queues" items={queueTabs} />
      <AlertBanner tone="info">
        Worker used <b>&ldquo;check in anyway&rdquo;</b> (far from the address or poor GPS). The start code is
        the real proof of presence — check it, then acknowledge or open the booking.
      </AlertBanner>
      <DataTable
        caption="Flagged check-ins"
        columns={columns}
        rows={FLAGGED_CHECK_INS}
        rowKey={(checkIn) => checkIn.visitId}
        empty="No flagged check-ins in the last 30 days."
      />
      <RequirePermission permission="ops.act">
        <AcknowledgeCheckInDialog checkIns={FLAGGED_CHECK_INS} />
      </RequirePermission>
    </>
  );
}

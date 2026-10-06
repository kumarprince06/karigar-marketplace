import { Banknote, Check, Inbox, RefreshCw, Undo2 } from 'lucide-react';
import {
  AlertBanner,
  Button,
  ButtonLink,
  CopyId,
  DataTable,
  EnumStatusChip,
  PermTag,
  StatusChip,
  type Column,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { formatMoney, formatShortId } from '@/lib/formatters';
import { MoneyQueueSection } from '../components/MoneyQueueSection';
import { DISPUTED_CASH_PAYMENTS, PARKED_PROVIDER_EVENTS, STUCK_REFUNDS } from '../mock-data';
import { DISPUTE_STATUS_TONES, REFUND_STATUS_TONES } from '../status-tones';
import type { DisputedCashPayment, ParkedProviderEvent, StuckRefund } from '../types';

const stuckRefundColumns: Column<StuckRefund>[] = [
  { id: 'refund', header: 'Refund', cell: (refund) => <CopyId id={refund.id} /> },
  {
    id: 'payment',
    header: 'Payment',
    cell: (refund) => (
      <span className="whitespace-nowrap">
        <CopyId id={refund.paymentId} />{' '}
        <span className="text-fg-muted text-xs">· {refund.paymentMethod}</span>
      </span>
    ),
  },
  {
    id: 'amount',
    header: 'Amount',
    align: 'right',
    className: 'font-semibold tabular-nums',
    cell: (refund) => formatMoney(refund.amountPaise),
  },
  { id: 'reason', header: 'Reason', cell: (refund) => refund.reasonCode },
  {
    id: 'status',
    header: 'Status',
    cell: (refund) => <EnumStatusChip status={refund.status} tones={REFUND_STATUS_TONES} />,
  },
  { id: 'age', header: 'Age', cell: (refund) => refund.ageLabel },
  { id: 'failure', header: 'Failure', className: 'font-mono text-xs', cell: (refund) => refund.failure },
  {
    id: 'actions',
    header: <span className="sr-only">Actions</span>,
    align: 'right',
    cell: (refund) => (
      <span className="inline-flex gap-2">
        <RequirePermission permission="finance.refund">
          <ButtonLink size="sm" to={`${paths.payments}?dialog=refund&payment=${refund.paymentId}`}>
            New refund (new key)
          </ButtonLink>
        </RequirePermission>
        <RequirePermission permission="ops.act">
          <Button size="sm" variant="ghost">
            Ack…
          </Button>
        </RequirePermission>
      </span>
    ),
  },
];

const parkedEventColumns: Column<ParkedProviderEvent>[] = [
  { id: 'event', header: 'Event', cell: (event) => <CopyId id={event.id} /> },
  { id: 'provider', header: 'Provider', cell: (event) => event.provider },
  { id: 'type', header: 'Type', className: 'font-mono text-xs', cell: (event) => event.eventType },
  { id: 'received', header: 'Received', cell: (event) => event.receivedLabel },
  { id: 'attempts', header: 'Attempts', align: 'right', cell: (event) => event.attempts },
  {
    id: 'error',
    header: 'Processing error',
    className: 'font-mono text-xs',
    cell: (event) => event.processingError,
  },
  {
    id: 'acknowledgement',
    header: <span className="sr-only">Acknowledgement</span>,
    align: 'right',
    cell: (event) =>
      event.acknowledgement ? (
        <StatusChip tone="success">
          <Check aria-hidden className="size-3.5" /> acked · {event.acknowledgement}
        </StatusChip>
      ) : (
        <RequirePermission permission="ops.act">
          <Button size="sm" variant="ghost">
            Ack…
          </Button>
        </RequirePermission>
      ),
  },
];

const disputedCashColumns: Column<DisputedCashPayment>[] = [
  { id: 'payment', header: 'Payment', cell: (row) => <CopyId id={row.paymentId} /> },
  { id: 'job', header: 'Job', cell: (row) => <CopyId id={row.bookingId} /> },
  {
    id: 'amount',
    header: 'Amount',
    align: 'right',
    className: 'font-semibold tabular-nums',
    cell: (row) => formatMoney(row.amountPaise),
  },
  { id: 'worker-marked', header: 'Worker marked', cell: (row) => row.workerMarkedLabel },
  { id: 'customer-says', header: 'Customer says', cell: (row) => row.customerSays },
  {
    id: 'dispute',
    header: 'Dispute',
    cell: (row) => (
      <EnumStatusChip
        status={row.disputeStatus}
        tones={DISPUTE_STATUS_TONES}
        prefix={`${formatShortId(row.disputeId)} · `}
      />
    ),
  },
  { id: 'age', header: 'Age', cell: (row) => row.ageLabel },
  {
    id: 'actions',
    header: <span className="sr-only">Actions</span>,
    align: 'right',
    cell: (row) => (
      <ButtonLink size="sm" variant="secondary" to={paths.dispute(row.disputeId)}>
        Open dispute
      </ButtonLink>
    ),
  },
];

/** A-05c Money queues: stuck refunds, parked provider events, disputed cash. */
export function MoneyQueuesPage() {
  const openParkedEventCount = PARKED_PROVIDER_EVENTS.filter((event) => !event.acknowledgement).length;

  return (
    <div className="flex flex-col gap-3.5">
      <MoneyQueueSection
        icon={Undo2}
        title="Stuck refunds"
        count={STUCK_REFUNDS.length}
        countTone={STUCK_REFUNDS.length > 0 ? 'error' : 'success'}
        rule={
          <>
            FAILED, or REQUESTED / PROCESSING &gt; 24 h · <PermTag>finance.view</PermTag>
          </>
        }
      >
        <DataTable
          caption="Stuck refunds"
          columns={stuckRefundColumns}
          rows={STUCK_REFUNDS}
          rowKey={(refund) => refund.id}
          empty="No stuck refunds."
        />
      </MoneyQueueSection>

      <MoneyQueueSection
        icon={Inbox}
        title="Parked provider events"
        count={openParkedEventCount}
        countTone={openParkedEventCount > 0 ? 'error' : 'success'}
        rule={
          <>
            verified webhooks not processed after 5 tries · <PermTag>finance.view</PermTag> · ack{' '}
            <PermTag>ops.act</PermTag>
          </>
        }
      >
        <DataTable
          caption="Parked provider events"
          columns={parkedEventColumns}
          rows={PARKED_PROVIDER_EVENTS}
          rowKey={(event) => event.id}
          empty="Nothing parked right now."
        />
        {openParkedEventCount === 0 && (
          <p className="text-fg-muted text-center text-[13px]">
            Nothing parked right now (acked rows shown for the last 24 h)
          </p>
        )}
      </MoneyQueueSection>

      <MoneyQueueSection
        icon={Banknote}
        title="Disputed cash"
        count={DISPUTED_CASH_PAYMENTS.length}
        countTone={DISPUTED_CASH_PAYMENTS.length > 0 ? 'warning' : 'success'}
        rule={
          <>
            cash payment DISPUTED · leaves when the dispute is resolved · <PermTag>ops.view</PermTag>
          </>
        }
      >
        <DataTable
          caption="Disputed cash payments"
          columns={disputedCashColumns}
          rows={DISPUTED_CASH_PAYMENTS}
          rowKey={(row) => row.paymentId}
          empty="No disputed cash payments."
        />
      </MoneyQueueSection>

      <AlertBanner tone="neutral" icon={RefreshCw}>
        Reconciliation runs daily against the provider; differences show up here as stuck refunds or parked
        events. Ack = <b>NO_ACTION</b> or <b>HANDLED_ELSEWHERE</b> + note.
      </AlertBanner>
    </div>
  );
}

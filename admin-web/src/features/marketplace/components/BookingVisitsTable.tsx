import { Check, Flag } from 'lucide-react';
import { DataTable, Money, type Column } from '@/components/ui';
import { formatMoney } from '@/lib/formatters';
import { formatClockTime, formatDayMonth } from '@/lib/formatters';
import type { BookingVisit } from '../types';
import { MarketplaceStatusChip } from './MarketplaceStatusChip';

const visitColumns: readonly Column<BookingVisit>[] = [
  { id: 'number', header: '#', cell: (visit) => visit.number },
  {
    id: 'date',
    className: 'whitespace-nowrap',
    header: 'Date · type',
    cell: (visit) => `${formatDayMonth(visit.date)} · ${visit.visitType}`,
  },
  {
    id: 'status',
    header: 'Visit',
    cell: (visit) => <MarketplaceStatusChip kind="visit" status={visit.status} />,
  },
  {
    id: 'on-my-way',
    className: 'whitespace-nowrap',
    header: 'On my way',
    cell: ({ onMyWay }) => (onMyWay ? `${formatClockTime(onMyWay.at)} · ETA ${onMyWay.etaMinutes}` : '—'),
  },
  {
    id: 'check-in',
    header: 'Check-in',
    cell: ({ checkIn }) => {
      if (!checkIn) return '—';
      const text = `${formatClockTime(checkIn.at)} · ${checkIn.distanceMetres} m`;
      return checkIn.flagged ? (
        <b className="text-error inline-flex items-center gap-1 whitespace-nowrap">
          {text} <Flag aria-hidden className="size-3.5" />
          <span className="sr-only">flagged, outside 300 m</span>
        </b>
      ) : (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {text} <Check aria-hidden className="text-success size-3.5" />
          <span className="sr-only">within range</span>
        </span>
      );
    },
  },
  {
    id: 'start-code',
    header: 'Start code',
    cell: ({ startCode }) =>
      startCode.verifiedAt ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Check aria-hidden className="text-success size-3.5" />
          <span className="sr-only">verified,</span> {startCode.attempts}{' '}
          {startCode.attempts === 1 ? 'try' : 'tries'} · {formatClockTime(startCode.verifiedAt)}
        </span>
      ) : (
        `${startCode.attempts} / ${startCode.maxAttempts}`
      ),
  },
  {
    id: 'check-out',
    header: 'Check-out',
    cell: (visit) => (visit.checkOutAt ? formatClockTime(visit.checkOutAt) : '—'),
  },
  {
    id: 'labour',
    header: 'Labour + helper',
    cell: ({ labour }) =>
      labour ? (
        <Money>
          {formatMoney(labour.labourPaise)} + {formatMoney(labour.helperPaise)}
        </Money>
      ) : (
        '—'
      ),
  },
  {
    id: 'confirmed',
    header: 'Confirmed',
    cell: ({ confirmedBy }) =>
      confirmedBy ? <MarketplaceStatusChip kind="visitConfirmation" status={confirmedBy} /> : '—',
  },
];

/** Visits of a booking with ETA, check-in distance (300 m rule) and start-code attempts. The code itself is never shown. */
export function BookingVisitsTable({ visits }: { visits: readonly BookingVisit[] }) {
  return (
    <DataTable dense caption="Visits" columns={visitColumns} rows={visits} rowKey={(visit) => visit.id} />
  );
}

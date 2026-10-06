import { AlarmClock, Scale, Search } from 'lucide-react';
import { useState } from 'react';
import {
  ArrowLink,
  CopyId,
  DataTable,
  FilterToggleButton,
  Input,
  Select,
  type Column,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { BOOKING_SUMMARIES } from '../mock-data';
import { STATUS_APPEARANCE } from '../status-display';
import type { BookingStatus, BookingSummary, JobStatus, VisitStatus } from '../types';
import { BookingSignalCell } from '../components/BookingSignalCell';
import { MarketplaceStatusChip } from '../components/MarketplaceStatusChip';
import { TradeLabel } from '../components/TradeLabel';

const BOOKING_STATUSES = Object.keys(STATUS_APPEARANCE.booking) as BookingStatus[];
const JOB_STATUSES = Object.keys(STATUS_APPEARANCE.job) as JobStatus[];
const VISIT_STATUSES = Object.keys(STATUS_APPEARANCE.visit) as VisitStatus[];

const bookingColumns: readonly Column<BookingSummary>[] = [
  { id: 'booking-id', header: 'Booking', cell: (booking) => <CopyId id={booking.id} /> },
  {
    id: 'trade',
    className: 'whitespace-nowrap',
    header: 'Trade',
    cell: (booking) => (
      <>
        <TradeLabel trade={booking.trade} title={booking.title} />
      </>
    ),
  },
  {
    id: 'customer',
    className: 'whitespace-nowrap',
    header: 'Customer',
    cell: (booking) => booking.customerName,
  },
  { id: 'worker', className: 'whitespace-nowrap', header: 'Worker', cell: (booking) => booking.workerName },
  { id: 'type', header: 'Type', cell: (booking) => booking.type },
  {
    id: 'next-visit',
    className: 'whitespace-nowrap',
    header: 'Next visit',
    cell: (booking) => booking.nextVisit ?? '—',
  },
  {
    id: 'booking-status',
    header: 'Booking',
    cell: (booking) => <MarketplaceStatusChip kind="booking" status={booking.bookingStatus} />,
  },
  {
    id: 'job-status',
    header: 'Job',
    cell: (booking) => <MarketplaceStatusChip kind="job" status={booking.jobStatus} />,
  },
  {
    id: 'visit-status',
    header: 'Visit',
    cell: (booking) => (
      <MarketplaceStatusChip kind="visit" status={booking.visitStatus} detail={booking.visitDetail} />
    ),
  },
  { id: 'signals', header: 'Signals', cell: (booking) => <BookingSignalCell booking={booking} /> },
  {
    id: 'open',
    header: <span className="sr-only">Open</span>,
    cell: (booking) => <ArrowLink to={paths.booking(booking.id)}>Open</ArrowLink>,
  },
];

/** A-03b: bookings with booking, job and visit as three separate chips (ADR 0009). */
export function BookingsPage() {
  const [searchText, setSearchText] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatus | 'ANY'>('ANY');
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatus | 'ANY'>('ANY');
  const [visitStatusFilter, setVisitStatusFilter] = useState<VisitStatus | 'ANY'>('ANY');
  const [dateFilter, setDateFilter] = useState('TODAY');
  const [onlyLate, setOnlyLate] = useState(false);
  const [onlyDisputed, setOnlyDisputed] = useState(false);

  const normalisedSearch = searchText.trim().toLowerCase();
  const visibleBookings = BOOKING_SUMMARIES.filter(
    (booking) =>
      (!normalisedSearch ||
        [booking.id, booking.customerName, booking.workerName].some((value) =>
          value.toLowerCase().includes(normalisedSearch),
        )) &&
      (bookingStatusFilter === 'ANY' || booking.bookingStatus === bookingStatusFilter) &&
      (jobStatusFilter === 'ANY' || booking.jobStatus === jobStatusFilter) &&
      (visitStatusFilter === 'ANY' || booking.visitStatus === visitStatusFilter) &&
      (!onlyLate || booking.signal?.kind === 'late') &&
      (!onlyDisputed || booking.signal?.kind === 'dispute'),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          leading={<Search className="size-4" />}
          aria-label="Booking, customer or worker id"
          placeholder="Booking / customer / worker id"
          className="min-w-0 flex-1 basis-full sm:w-[240px] sm:flex-none sm:basis-auto"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <Select
          aria-label="Booking status"
          className="min-w-0 flex-1 basis-40 sm:w-[160px] sm:flex-none"
          value={bookingStatusFilter}
          onChange={(event) => setBookingStatusFilter(event.target.value as BookingStatus | 'ANY')}
        >
          <option value="ANY">Booking: any</option>
          {BOOKING_STATUSES.map((status) => (
            <option key={status} value={status}>
              Booking: {status}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Job status"
          className="min-w-0 flex-1 basis-40 sm:w-[150px] sm:flex-none"
          value={jobStatusFilter}
          onChange={(event) => setJobStatusFilter(event.target.value as JobStatus | 'ANY')}
        >
          <option value="ANY">Job: any</option>
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>
              Job: {status}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Visit status today"
          className="min-w-0 flex-1 basis-40 sm:w-[170px] sm:flex-none"
          value={visitStatusFilter}
          onChange={(event) => setVisitStatusFilter(event.target.value as VisitStatus | 'ANY')}
        >
          <option value="ANY">Visit today: any</option>
          {VISIT_STATUSES.map((status) => (
            <option key={status} value={status}>
              Visit today: {status}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Date"
          className="min-w-0 flex-1 basis-40 sm:w-[150px] sm:flex-none"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
        >
          <option value="TODAY">Today</option>
          <option value="TOMORROW">Tomorrow</option>
          <option value="LAST_7_DAYS">Last 7 days</option>
        </Select>
        <FilterToggleButton icon={AlarmClock} pressed={onlyLate} onPressedChange={setOnlyLate}>
          Late only
        </FilterToggleButton>
        <FilterToggleButton icon={Scale} pressed={onlyDisputed} onPressedChange={setOnlyDisputed}>
          Disputed
        </FilterToggleButton>
      </div>

      <DataTable
        caption="Bookings"
        columns={bookingColumns}
        rows={visibleBookings}
        rowKey={(booking) => booking.id}
        empty="No bookings match these filters."
        rowClassName={(booking) => (booking.signal?.kind === 'late' ? 'bg-warning-subtle' : undefined)}
      />

      <div className="text-fg-muted flex flex-col gap-1 text-[13px] md:flex-row md:justify-between md:gap-4">
        <span>Showing {visibleBookings.length} · cursor pages of 50 · no bulk actions, no export</span>
        <span>
          Lateness is derived: visit SCHEDULED and now &gt; start (no-show report from 60 min, auto at 2 h)
        </span>
      </div>
    </>
  );
}

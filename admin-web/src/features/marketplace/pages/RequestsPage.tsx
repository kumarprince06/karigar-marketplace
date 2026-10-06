import { Eye, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { CopyId, DataTable, FilterToggleButton, Select, StatusChip, type Column } from '@/components/ui';
import { formatClockTime } from '@/lib/formatters';
import { MARKETPLACE_REQUESTS, REQUEST_NEEDING_ATTENTION } from '../mock-data';
import { TRADE_LABELS } from '../status-display';
import type { MarketplaceRequest, RequestStatus, RequestUrgency, Trade } from '../types';
import { MarketplaceStatusChip } from '../components/MarketplaceStatusChip';
import { RequestAdvanceChip } from '../components/RequestAdvanceChip';
import { RequestAttentionCard } from '../components/RequestAttentionCard';
import { TradeLabel } from '../components/TradeLabel';

const OPEN_REQUEST_STATUSES: readonly RequestStatus[] = [
  'PENDING_PAYMENT',
  'SUBMITTED',
  'MATCHING',
  'AWAITING_SELECTION',
];
const ALL_REQUEST_STATUSES: readonly RequestStatus[] = [
  ...OPEN_REQUEST_STATUSES,
  'BOOKED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED_TO_MATCH',
];
const URGENCIES: readonly RequestUrgency[] = ['EMERGENCY', 'NOW', 'TODAY', 'SCHEDULED'];
const TRADES: readonly Trade[] = ['ELECTRICIAN', 'PLUMBER'];

type StatusFilter = 'ALL' | 'OPEN' | RequestStatus;

/** "No interested worker" = offers sent, nobody accepted yet (A-03a data note). */
function hasNoInterestedWorker(request: MarketplaceRequest): boolean {
  const run = request.matchingRun;
  return run !== null && run.offeredCount > 0 && run.interestedCount === 0;
}

const requestColumns: readonly Column<MarketplaceRequest>[] = [
  {
    id: 'request',
    header: 'Request',
    cell: (request) => (
      <>
        <CopyId id={request.id} />
        <span className="text-fg-muted block">{formatClockTime(request.createdAt)}</span>
      </>
    ),
  },
  {
    id: 'trade',
    className: 'whitespace-nowrap',
    header: 'Trade · area',
    cell: (request) => (
      <>
        <TradeLabel trade={request.trade} title={request.title} />
        <span className="text-fg-muted block">{request.area}</span>
      </>
    ),
  },
  {
    id: 'urgency',
    header: 'Urgency',
    cell: (request) => <MarketplaceStatusChip kind="urgency" status={request.urgency} />,
  },
  { id: 'advance', header: 'Advance', cell: (request) => <RequestAdvanceChip advance={request.advance} /> },
  {
    id: 'status',
    header: 'Request status',
    cell: (request) => <MarketplaceStatusChip kind="request" status={request.status} />,
  },
  {
    id: 'matching',
    header: 'Matching run · offers',
    cell: ({ matchingRun }) =>
      matchingRun ? (
        <>
          <MarketplaceStatusChip kind="matchingRun" status={matchingRun.status} detail={matchingRun.detail} />
          <span className="text-fg-muted block text-[13px]">
            {matchingRun.radiusKm !== undefined && `${matchingRun.radiusKm} km · `}
            {matchingRun.offeredCount} offered ·{' '}
            <b className={matchingRun.interestedCount === 0 ? 'text-error' : 'font-normal'}>
              {matchingRun.interestedCount} interested
            </b>
          </span>
        </>
      ) : (
        <>
          —<span className="text-fg-muted block text-[13px]">—</span>
        </>
      ),
  },
];

/** A-03a: read-only list of customer requests and their matching runs (no interventions in MVP, P24). */
export function RequestsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<RequestUrgency | 'ANY'>('ANY');
  const [tradeFilter, setTradeFilter] = useState<Trade | 'ANY'>('ANY');
  const [dateFilter, setDateFilter] = useState('TODAY');
  const [onlyNoInterestedWorker, setOnlyNoInterestedWorker] = useState(false);

  const visibleRequests = MARKETPLACE_REQUESTS.filter(
    (request) =>
      (statusFilter === 'ALL' ||
        (statusFilter === 'OPEN'
          ? OPEN_REQUEST_STATUSES.includes(request.status)
          : request.status === statusFilter)) &&
      (urgencyFilter === 'ANY' || request.urgency === urgencyFilter) &&
      (tradeFilter === 'ANY' || request.trade === tradeFilter) &&
      (!onlyNoInterestedWorker || hasNoInterestedWorker(request)),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Request status"
          className="min-w-0 flex-1 basis-40 sm:w-[200px] sm:flex-none"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="ALL">Status: all</option>
          <option value="OPEN">Status: all open</option>
          {ALL_REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              Status: {status}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Urgency"
          className="min-w-0 flex-1 basis-40 sm:w-[150px] sm:flex-none"
          value={urgencyFilter}
          onChange={(event) => setUrgencyFilter(event.target.value as RequestUrgency | 'ANY')}
        >
          <option value="ANY">Urgency: any</option>
          {URGENCIES.map((urgency) => (
            <option key={urgency} value={urgency}>
              Urgency: {urgency}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Trade"
          className="min-w-0 flex-1 basis-40 sm:w-[150px] sm:flex-none"
          value={tradeFilter}
          onChange={(event) => setTradeFilter(event.target.value as Trade | 'ANY')}
        >
          <option value="ANY">Trade: any</option>
          {TRADES.map((trade) => (
            <option key={trade} value={trade}>
              Trade: {TRADE_LABELS[trade]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Created"
          className="min-w-0 flex-1 basis-40 sm:w-[170px] sm:flex-none"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
        >
          <option value="TODAY">Today</option>
          <option value="YESTERDAY">Yesterday</option>
          <option value="LAST_7_DAYS">Last 7 days</option>
        </Select>
        <FilterToggleButton
          icon={TriangleAlert}
          pressed={onlyNoInterestedWorker}
          onPressedChange={setOnlyNoInterestedWorker}
        >
          No interested worker
        </FilterToggleButton>
        <StatusChip tone="neutral" className="xl:ml-auto">
          <Eye aria-hidden className="size-3.5" /> Read-only · no interventions in MVP
        </StatusChip>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <DataTable
          className="min-w-0 xl:flex-1"
          caption="Requests"
          columns={requestColumns}
          rows={visibleRequests}
          rowKey={(request) => request.id}
          empty="No requests match these filters."
          rowClassName={(request) =>
            request.status === 'FAILED_TO_MATCH'
              ? 'bg-error-subtle'
              : request.id === REQUEST_NEEDING_ATTENTION.request.id
                ? 'bg-accent-subtle'
                : undefined
          }
        />
        <aside
          aria-label="Request needing attention"
          className="flex flex-col gap-3 xl:w-[310px] xl:shrink-0"
        >
          <RequestAttentionCard detail={REQUEST_NEEDING_ATTENTION} />
        </aside>
      </div>
    </>
  );
}

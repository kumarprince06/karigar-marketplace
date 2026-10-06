import { Phone, Timer } from 'lucide-react';
import { useState } from 'react';
import {
  AlertBanner,
  Button,
  ButtonLink,
  CopyId,
  DataTable,
  Select,
  StatusChip,
  Tabs,
  type Column,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { DISPUTE_QUEUE, DISPUTE_QUEUE_TAB_COUNTS } from '../mock-data';
import { DISPUTE_PRIORITY_CHIP, DISPUTE_STATUS_CHIP } from '../status-chip-presentation';
import { DISPUTE_CATEGORIES, type DisputeQueueRow } from '../types';
import { DirectionArrow } from '../components/DirectionArrow';

type DisputeQueueTab = 'OPEN' | 'AWAITING_RESPONSE' | 'IN_REVIEW' | 'CLOSED';

const DISPUTE_QUEUE_COLUMNS: readonly Column<DisputeQueueRow>[] = [
  { id: 'case', header: 'Case', cell: (row) => <CopyId id={row.id} /> },
  {
    id: 'priority',
    header: 'Priority',
    cell: (row) => (
      <StatusChip tone={DISPUTE_PRIORITY_CHIP[row.priority].tone}>
        {DISPUTE_PRIORITY_CHIP[row.priority].label}
      </StatusChip>
    ),
  },
  { id: 'category', header: 'Category', cell: (row) => row.category },
  {
    id: 'subject',
    header: 'Subject',
    cell: (row) => (
      <span className="whitespace-nowrap">
        {row.subject.kind}
        {row.subject.kind === 'VISIT' && row.subject.detail && ` ${row.subject.detail}`}{' '}
        <CopyId id={row.subject.id} />
        {row.subject.kind === 'PAYMENT' && row.subject.detail && ` · ${row.subject.detail}`}
      </span>
    ),
  },
  { id: 'openedBy', header: 'Opened by', cell: (row) => row.openedBy },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <StatusChip tone={DISPUTE_STATUS_CHIP[row.status].tone}>
        {DISPUTE_STATUS_CHIP[row.status].label}
      </StatusChip>
    ),
  },
  { id: 'respondentAnswer', header: 'Respondent answer', cell: (row) => row.respondentAnswer },
  {
    id: 'assignee',
    header: 'Assignee',
    cell: (row) => row.assignee ?? <span className="text-fg-subtle">—</span>,
  },
  { id: 'age', header: 'Age', cell: (row) => row.age },
  {
    id: 'action',
    header: <span className="sr-only">Action</span>,
    cell: (row) => (
      <RequirePermission permission="dispute.manage">
        {row.assignee ? (
          <ButtonLink to={paths.dispute(row.id)} variant="secondary" size="sm">
            Open
          </ButtonLink>
        ) : (
          <ButtonLink to={paths.dispute(row.id)} size="sm">
            Claim
          </ButtonLink>
        )}
      </RequirePermission>
    ),
  },
];

/** A-04d. Oldest first within priority; HIGH for DAMAGE and BEHAVIOUR (LLD-018 D12). */
export function DisputeQueuePage() {
  const [activeTab, setActiveTab] = useState<DisputeQueueTab>('OPEN');
  const [priorityFilter, setPriorityFilter] = useState('any');
  const [categoryFilter, setCategoryFilter] = useState('any');
  const [zoneFilter, setZoneFilter] = useState('Howrah');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Dispute status"
          className="max-w-full border-b-0"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'OPEN', label: 'Open', count: DISPUTE_QUEUE_TAB_COUNTS.open },
            {
              id: 'AWAITING_RESPONSE',
              label: 'AWAITING_RESPONSE',
              count: DISPUTE_QUEUE_TAB_COUNTS.awaitingResponse,
            },
            { id: 'IN_REVIEW', label: 'IN_REVIEW', count: DISPUTE_QUEUE_TAB_COUNTS.inReview },
            { id: 'CLOSED', label: 'Closed' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="w-[150px]"
          >
            <option value="any">Priority: any</option>
            <option value="HIGH">Priority: HIGH</option>
            <option value="NORMAL">Priority: NORMAL</option>
          </Select>
          <Select
            aria-label="Category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="w-[170px]"
          >
            <option value="any">Category: any</option>
            {DISPUTE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                Category: {category}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Zone"
            value={zoneFilter}
            onChange={(event) => setZoneFilter(event.target.value)}
            className="w-[150px]"
          >
            <option value="Howrah">Zone: Howrah</option>
            <option value="any">Zone: any</option>
          </Select>
          <RequirePermission permission="dispute.manage">
            <Button variant="secondary" size="sm">
              <Phone aria-hidden className="size-4" /> Open on behalf of a caller
            </Button>
          </RequirePermission>
        </div>
      </div>

      <DataTable
        caption="Dispute queue"
        columns={DISPUTE_QUEUE_COLUMNS}
        rows={DISPUTE_QUEUE}
        rowKey={(row) => row.id}
      />

      <AlertBanner tone="neutral" icon={Timer}>
        Oldest first within priority. Alert when the oldest open case is over 72 h. Claiming moves
        AWAITING_RESPONSE <DirectionArrow /> IN_REVIEW.
      </AlertBanner>
    </>
  );
}

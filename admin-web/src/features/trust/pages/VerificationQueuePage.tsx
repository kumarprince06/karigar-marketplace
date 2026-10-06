import { useState } from 'react';
import { Link } from 'react-router';
import {
  ButtonLink,
  Card,
  CopyId,
  DataTable,
  KpiTile,
  Select,
  StatusChip,
  Tabs,
  type Column,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { mergeClassNames } from '@/lib/merge-class-names';
import { DEMO_IDS } from '@/mocks/demo-ids';
import { VERIFICATION_MAX_WAIT_HOURS, VERIFICATION_QUEUE, VERIFICATION_QUEUE_SUMMARY } from '../mock-data';
import { VERIFICATION_PRIORITY_CHIP, VERIFICATION_STATUS_CHIP } from '../status-chip-presentation';
import type { VerificationQueueRow } from '../types';

type VerificationQueueTab = 'PENDING' | 'IN_REVIEW' | 'DECIDED_TODAY';

const VERIFICATION_QUEUE_COLUMNS: readonly Column<VerificationQueueRow>[] = [
  {
    id: 'priority',
    header: 'Priority',
    cell: (row) => (
      <StatusChip tone={VERIFICATION_PRIORITY_CHIP[row.priority].tone}>
        {VERIFICATION_PRIORITY_CHIP[row.priority].label}
      </StatusChip>
    ),
  },
  {
    id: 'worker',
    header: 'Worker',
    cell: (row) => (
      <span className="whitespace-nowrap">
        <Link to={paths.worker(DEMO_IDS.worker)} className="hover:text-primary font-bold">
          {row.workerName}
        </Link>{' '}
        <CopyId id={row.workerId} />
      </span>
    ),
  },
  { id: 'check', header: 'Check', cell: (row) => row.checkType },
  {
    id: 'document',
    header: 'Document',
    cell: (row) => (
      <>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <row.documentIcon aria-hidden className="size-4" /> {row.documentLabel}
        </span>
      </>
    ),
  },
  {
    id: 'trade',
    header: 'Trade',
    cell: (row) =>
      row.trade ? (
        <>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <row.trade.icon aria-hidden className="size-4" /> {row.trade.label}
          </span>
        </>
      ) : (
        '—'
      ),
  },
  {
    id: 'submitted',
    header: 'Submitted',
    cell: (row) => (
      <span
        className={mergeClassNames(
          'whitespace-nowrap',
          row.submittedHoursAgo > VERIFICATION_MAX_WAIT_HOURS && 'text-error font-bold',
        )}
      >
        {row.submittedHoursAgo} h ago
      </span>
    ),
  },
  {
    id: 'attempt',
    header: 'Attempt',
    cell: (row) => (
      <span className="whitespace-nowrap">
        {row.attemptLabel} {row.attemptHint && <span className="text-fg-subtle">{row.attemptHint}</span>}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <StatusChip tone={VERIFICATION_STATUS_CHIP[row.status].tone}>
        {VERIFICATION_STATUS_CHIP[row.status].label}
        {row.claimedBy && ` · ${row.claimedBy}`}
      </StatusChip>
    ),
  },
  {
    id: 'action',
    header: <span className="sr-only">Action</span>,
    cell: (row) => (
      <RequirePermission permission="verification.review">
        {row.status === 'PENDING' ? (
          <ButtonLink to={paths.verification(row.id)} size="sm">
            Claim &amp; review
          </ButtonLink>
        ) : (
          <ButtonLink to={paths.verification(row.id)} variant="secondary" size="sm">
            View
          </ButtonLink>
        )}
      </RequirePermission>
    ),
  },
];

/** A-04a. Ordered by priority, then oldest first (LLD-016 D10). */
export function VerificationQueuePage() {
  const [activeTab, setActiveTab] = useState<VerificationQueueTab>('PENDING');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('any');
  const [tradeFilter, setTradeFilter] = useState('any');
  const summary = VERIFICATION_QUEUE_SUMMARY;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card variant="brand" className="gap-0">
          <span className="text-[13px] text-white/85">Waiting (PENDING)</span>
          <b className="text-display tabular-nums">{summary.pendingCount}</b>
          <span className="text-[13px] text-white/85">+{summary.inReviewCount} IN_REVIEW</span>
        </Card>
        <KpiTile
          label="Oldest"
          value={<span className="text-error">{summary.oldestHours} h</span>}
          hint="SLA 24 h P90 · 48 h max"
        />
        <KpiTile
          label="Blocked from all jobs (P1)"
          value={summary.blockedFromAllJobsCount}
          hint="reviewed first"
        />
        <KpiTile
          label="Mine in review"
          value={summary.mineInReviewCount}
          hint="claims older than 30 min can be taken over"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Verification status"
          className="max-w-full border-b-0"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'PENDING', label: 'PENDING', count: summary.pendingCount },
            { id: 'IN_REVIEW', label: 'IN_REVIEW', count: summary.inReviewCount },
            { id: 'DECIDED_TODAY', label: 'Decided today', count: summary.decidedTodayCount },
          ]}
        />
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Select
            aria-label="Check type"
            value={documentTypeFilter}
            onChange={(event) => setDocumentTypeFilter(event.target.value)}
            className="w-[170px]"
          >
            <option value="any">Type: any</option>
            {['ID_PROOF', 'PAN', 'POLICE_VERIFICATION', 'SKILL_CERTIFICATE', 'ELECTRICAL_LICENSE'].map(
              (type) => (
                <option key={type} value={type}>
                  Type: {type}
                </option>
              ),
            )}
          </Select>
          <Select
            aria-label="Trade"
            value={tradeFilter}
            onChange={(event) => setTradeFilter(event.target.value)}
            className="w-[170px]"
          >
            <option value="any">Trade: any</option>
            <option value="Electrician">Trade: Electrician</option>
            <option value="Plumber">Trade: Plumber</option>
          </Select>
        </div>
      </div>

      <DataTable
        caption="Verification queue"
        columns={VERIFICATION_QUEUE_COLUMNS}
        rows={VERIFICATION_QUEUE}
        rowKey={(row) => row.id}
      />
    </>
  );
}

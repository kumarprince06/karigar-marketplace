import { BookOpen, CreditCard, Lock, MessageSquare, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, CopyId, Input, Money, StatusChip, Textarea } from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { formatMoney } from '@/lib/formatters';
import { DEMO_IDS } from '@/mocks/demo-ids';
import { DISPUTE_PRIORITY_CHIP, DISPUTE_STATUS_CHIP } from '../status-chip-presentation';
import type { OpenDispute } from '../types';
import { DisputeDecisionForm } from './DisputeDecisionForm';
import { DisputeEventFeed } from './DisputeEventFeed';
import { SummaryRows } from './SummaryRows';

/** A-04e. Statements, staff-only evidence and internal notes, and the decision panel. */
export function OpenDisputeInvestigation({ dispute }: { dispute: OpenDispute }) {
  const [messageToParties, setMessageToParties] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const statusChip = DISPUTE_STATUS_CHIP[dispute.status];
  const priorityChip = DISPUTE_PRIORITY_CHIP[dispute.priority];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <b className="text-h4">
            {dispute.category} ·{' '}
            <Link to={paths.booking(DEMO_IDS.booking)} className="hover:text-primary">
              {dispute.subjectLabel}
            </Link>{' '}
            <CopyId id={dispute.subjectId} />
          </b>
          <StatusChip tone={statusChip.tone}>
            {statusChip.label}
            {dispute.assignedToMe && ' · you'}
          </StatusChip>
          <StatusChip tone={priorityChip.tone}>{priorityChip.label}</StatusChip>
          <span className="text-fg-muted text-[13px]">
            <Link to={paths.customer(DEMO_IDS.customer)} className="hover:text-primary">
              {dispute.customerName}
            </Link>{' '}
            (customer) vs{' '}
            <Link to={paths.worker(DEMO_IDS.worker)} className="hover:text-primary">
              {dispute.workerName}
            </Link>{' '}
            (worker) · {dispute.openedSummary}
          </span>
        </div>
        <RequirePermission permission="dispute.resolve">
          <Button variant="dangerOutline" size="sm">
            Reject case…
          </Button>
        </RequirePermission>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_400px]">
        <Card className="gap-2">
          <div className="flex items-center justify-between">
            <b className="text-h4">
              <MessageSquare aria-hidden className="inline size-[18px] align-[-3px]" /> Statements
            </b>
            <span className="text-fg-muted text-[13px]">both parties see these</span>
          </div>
          <DisputeEventFeed events={dispute.statements} />
          <RequirePermission permission="dispute.manage">
            <Textarea
              aria-label="Message to both parties"
              placeholder="Message to both parties…"
              value={messageToParties}
              onChange={(event) => setMessageToParties(event.target.value)}
              className="mt-2 min-h-16 text-[13px]"
            />
            <Button variant="secondary" size="sm">
              Send message
            </Button>
          </RequirePermission>
        </Card>

        <div className="flex min-w-0 flex-col gap-2.5">
          <Card className="gap-1.5">
            <b className="text-h4">
              <Search aria-hidden className="inline size-[18px] align-[-3px]" /> System evidence{' '}
              <span className="text-fg-subtle text-[13px] font-normal">(staff only)</span>
            </b>
            <SummaryRows
              rows={[
                ...dispute.systemEvidence.map((evidence) => ({
                  label: evidence.label,
                  value: (
                    <>
                      {evidence.icon && (
                        <evidence.icon aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                      )}
                      {evidence.value}
                    </>
                  ),
                })),
                { label: 'Job', value: <StatusChip tone="warning">{dispute.jobStatus}</StatusChip> },
                { label: 'Bill', value: <Money>{formatMoney(dispute.billPaise)}</Money> },
              ]}
            />
          </Card>
          <Card className="gap-1.5">
            <b className="text-h4">
              <CreditCard aria-hidden className="inline size-[18px] align-[-3px]" /> Payments
            </b>
            <SummaryRows
              rows={[
                ...dispute.payments.map((payment) => ({
                  label: (
                    <>
                      {payment.label} {payment.paymentId && <CopyId id={payment.paymentId} />}
                    </>
                  ),
                  value: `${formatMoney(payment.amountPaise)} · ${payment.status}`,
                })),
                {
                  label: 'Refundable online',
                  value: <Money>{formatMoney(dispute.refundableOnlinePaise)}</Money>,
                },
              ]}
            />
          </Card>
          <Card className="gap-1.5">
            <b className="text-h4">
              <BookOpen aria-hidden className="inline size-[18px] align-[-3px]" /> History
            </b>
            {dispute.partyHistory.map((historyLine) => (
              <p key={historyLine} className="text-[13px]">
                {historyLine}
              </p>
            ))}
          </Card>
          <Card className="bg-accent-subtle border-accent/40 gap-1.5">
            <div className="flex items-center justify-between">
              <b className="text-h4">
                <Lock aria-hidden className="inline size-[18px] align-[-3px]" /> Internal notes
              </b>
              <StatusChip tone="neutral">never shown to parties</StatusChip>
            </div>
            {dispute.internalNotes.map((note) => (
              <p key={note.id} className="text-[13px]">
                {note.author} · {note.text}
              </p>
            ))}
            <RequirePermission permission="dispute.manage">
              <Input
                aria-label="Add internal note"
                placeholder="Add internal note…"
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
                className="min-h-[34px] text-[13px]"
              />
            </RequirePermission>
          </Card>
        </div>

        <DisputeDecisionForm dispute={dispute} />
      </div>
    </>
  );
}

import {
  Banknote,
  ReceiptText,
  RotateCcw,
  Scale,
  TriangleAlert,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  Card,
  Field,
  Input,
  PermTag,
  SectionLabel,
  SegmentedControl,
  Textarea,
} from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { formatMoney } from '@/lib/formatters';
import type {
  DisputeActionType,
  DisputeAtFault,
  DisputeOutcome,
  DraftDisputeAction,
  OpenDispute,
} from '../types';

const OUTCOME_OPTIONS: readonly { value: DisputeOutcome; label: string }[] = [
  { value: 'UPHELD', label: 'UPHELD' },
  { value: 'PARTIALLY_UPHELD', label: 'PARTIALLY_UPHELD' },
  { value: 'NOT_UPHELD', label: 'NOT_UPHELD' },
];

const AT_FAULT_OPTIONS: readonly { value: DisputeAtFault; label: string }[] = [
  { value: 'WORKER', label: 'WORKER' },
  { value: 'CUSTOMER', label: 'CUSTOMER' },
  { value: 'BOTH', label: 'BOTH' },
  { value: 'NONE', label: 'NONE' },
];

const ACTION_ICON: Record<DisputeActionType, LucideIcon> = {
  REFUND: Undo2,
  WORKER_STRIKE: TriangleAlert,
  ADJUST_VISIT: ReceiptText,
  REVOKE_STRIKE: RotateCcw,
  CASH_CONFIRM_PAID: Banknote,
};

/** Refund total above this also needs finance.refund (LLD-018). */
const REFUND_SECOND_PERMISSION_THRESHOLD_PAISE = 500000;

/** A-04e decision: outcome + at fault + actions + summary, sent with an Idempotency-Key. */
export function DisputeDecisionForm({ dispute }: { dispute: OpenDispute }) {
  const draft = dispute.draftDecision;
  const [outcome, setOutcome] = useState(draft.outcome);
  const [atFault, setAtFault] = useState(draft.atFault);
  const [actions, setActions] = useState<readonly DraftDisputeAction[]>(draft.actions);
  const [summary, setSummary] = useState(draft.summary);

  const handleAddAction = (type: DisputeActionType) =>
    setActions((current) => [
      ...current,
      { id: `${type}-${current.length + 1}`, type, detail: 'details on save' },
    ]);
  const handleRemoveAction = (actionId: string) =>
    setActions((current) => current.filter((action) => action.id !== actionId));
  const handleRefundAmountChange = (actionId: string, rupees: string) =>
    setActions((current) =>
      current.map((action) =>
        action.id === actionId ? { ...action, amountPaise: Math.round(Number(rupees) * 100) || 0 } : action,
      ),
    );

  return (
    <Card stripe="primary" className="gap-2 self-start">
      <div className="flex items-center justify-between">
        <b className="text-h4">
          <Scale aria-hidden className="inline size-[18px] align-[-3px]" /> Decision
        </b>
        <PermTag>dispute.resolve</PermTag>
      </div>
      <RequirePermission
        permission="dispute.resolve"
        fallback={
          <p className="text-fg-muted text-[13px]">
            Deciding a case needs <PermTag>dispute.resolve</PermTag>.
          </p>
        }
      >
        <SectionLabel>Outcome</SectionLabel>
        <SegmentedControl label="Outcome" options={OUTCOME_OPTIONS} value={outcome} onChange={setOutcome} />
        <SectionLabel>At fault</SectionLabel>
        <SegmentedControl label="At fault" options={AT_FAULT_OPTIONS} value={atFault} onChange={setAtFault} />

        <SectionLabel>Actions</SectionLabel>
        <ul className="flex flex-col gap-2">
          {actions.map((action) => {
            const ActionIcon = ACTION_ICON[action.type];
            return (
              <li
                key={action.id}
                className="border-border bg-surface flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2 text-[13px]"
              >
                <ActionIcon aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <b>{action.type}</b> {action.type === 'REFUND' ? action.detail : `· ${action.detail}`}
                </span>
                {action.type === 'REFUND' ? (
                  <Input
                    aria-label="Refund amount in rupees"
                    inputMode="decimal"
                    leading="₹"
                    value={String((action.amountPaise ?? 0) / 100)}
                    onChange={(event) => handleRefundAmountChange(action.id, event.target.value)}
                    className="min-h-[30px] w-[90px] text-[13px]"
                  />
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove ${action.type}`}
                    onClick={() => handleRemoveAction(action.id)}
                    className="text-fg-muted hover:text-error grid size-8 cursor-pointer place-items-center"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleAddAction('ADJUST_VISIT')}>
            + ADJUST_VISIT
          </Button>
          <RequirePermission permission="worker.enforce">
            <Button variant="ghost" size="sm" onClick={() => handleAddAction('REVOKE_STRIKE')}>
              + REVOKE_STRIKE
            </Button>
          </RequirePermission>
          <Button variant="ghost" size="sm" disabled title="Only for cash payments">
            CASH_* (cash only)
          </Button>
        </div>

        <Field label="Summary" hint="(both parties see this)">
          {({ id }) => (
            <Textarea
              id={id}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              className="min-h-[70px] text-[13px]"
            />
          )}
        </Field>
        <p className="text-fg-muted text-[13px]">
          Refunds only from online payments. A refund total over{' '}
          {formatMoney(REFUND_SECOND_PERMISSION_THRESHOLD_PAISE)} also needs <PermTag>finance.refund</PermTag>
          . Earnings are released automatically when the case closes.
        </p>
        <Button block>Resolve case</Button>
      </RequirePermission>
    </Card>
  );
}

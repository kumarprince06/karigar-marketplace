import { OctagonX } from 'lucide-react';
import {
  AlertBanner,
  Button,
  Card,
  DataTable,
  KeyValueList,
  ModalDialog,
  PermTag,
  StatusChip,
  type Column,
} from '@/components/ui';
import { RequirePermission, useSession } from '@/features/auth';
import { VERIFICATION_STATUS_CHIP } from '../status-chip-presentation';
import type { VerificationCheckHistoryRow, VerificationReview } from '../types';

const CHECK_HISTORY_COLUMNS: readonly Column<VerificationCheckHistoryRow>[] = [
  {
    id: 'check',
    header: 'Check',
    cell: (row) => (
      <span className="whitespace-nowrap">
        {row.checkLabel}
        {row.tradeIcon && (
          <>
            {' · '}
            <row.tradeIcon aria-hidden className="inline size-3.5 align-[-2px]" />
          </>
        )}
      </span>
    ),
  },
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
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        <StatusChip tone={VERIFICATION_STATUS_CHIP[row.status].tone}>
          {VERIFICATION_STATUS_CHIP[row.status].label}
        </StatusChip>
        {row.revokeRequested && <StatusChip tone="warning">revoke requested</StatusChip>}
        {row.rejectReason && <span className="text-fg-subtle">{row.rejectReason}</span>}
      </span>
    ),
  },
  { id: 'decided', header: 'Decided', cell: (row) => row.decidedOn },
  { id: 'validUntil', header: 'Valid until', cell: (row) => row.validUntil },
  { id: 'reviewer', header: 'Reviewer', cell: (row) => row.reviewer },
];

/**
 * A-04c. Revoking a VERIFIED check needs two admins: one requests, a different one confirms
 * (LLD-016 D9). SYSTEM revocations (consent withdrawn) need none.
 */
export function RevokeVerificationDialog({
  review,
  open,
  onClose,
}: {
  review: VerificationReview;
  open: boolean;
  onClose: () => void;
}) {
  const { session } = useSession();
  const request = review.revocationRequest;
  const isOwnRequest = session.name === request.requestedBy;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      size="xl"
      title={`${review.workerName} · check history`}
      aside={<PermTag>verification.review</PermTag>}
    >
      <DataTable
        caption="Verification checks"
        columns={CHECK_HISTORY_COLUMNS}
        rows={review.checkHistory}
        rowKey={(row) => row.id}
        rowClassName={(row) => (row.revokeRequested ? 'bg-warning-subtle' : undefined)}
        dense
      />
      <AlertBanner tone="info">
        Statuses: PENDING · IN_REVIEW · VERIFIED · REJECTED · EXPIRED · REVOKED · SUPERSEDED. Resubmission
        makes a new row; old rows keep their history.
      </AlertBanner>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card stripe="error">
          <div className="flex items-center justify-between">
            <b className="text-h4">
              <OctagonX aria-hidden className="inline size-[18px] align-[-3px]" /> Revocation requested
            </b>
            <StatusChip tone="warning">needs 2nd admin</StatusChip>
          </div>
          <KeyValueList
            labelWidth="sm"
            items={[
              { label: 'Check', value: request.checkLabel },
              { label: 'Requested by', value: `${request.requestedBy} · ${request.requestedAt}` },
              { label: 'Reason', value: request.reasonCode },
              { label: 'Note', value: request.note },
            ]}
          />
          <AlertBanner tone="warning">Confirming sets REVOKED. {request.consequence}</AlertBanner>
          <RequirePermission permission="verification.review">
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" className="flex-1" disabled={isOwnRequest} onClick={onClose}>
                Confirm revocation
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cancel request
              </Button>
            </div>
          </RequirePermission>
          <p className="text-fg-muted text-[13px]">
            You can't confirm a request you made yourself. The requester or another admin may cancel it.
          </p>
        </Card>
        <Card className="self-start">
          <b className="text-h4">Request a revocation</b>
          <p className="text-fg-muted text-[13px]">
            On a VERIFIED check: pick a reason (SAFETY_COMPLAINT · SUSPECTED_FORGERY · REVIEWER_ERROR · OTHER)
            and a note. A second admin confirms.
          </p>
        </Card>
      </div>
    </ModalDialog>
  );
}

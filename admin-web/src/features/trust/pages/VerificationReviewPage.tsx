import { ReceiptText, Timer } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { AlertBanner, Button, Card, CopyId, StatusChip } from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { DEMO_IDS } from '@/mocks/demo-ids';
import { DocumentPreview } from '../components/DocumentPreview';
import { RevokeVerificationDialog } from '../components/RevokeVerificationDialog';
import { VerificationDecisionForm } from '../components/VerificationDecisionForm';
import { VERIFICATION_MAX_WAIT_HOURS, findVerificationReview } from '../mock-data';
import { VERIFICATION_PRIORITY_CHIP, VERIFICATION_STATUS_CHIP } from '../status-chip-presentation';

/** A-04b. Claimed review of one check: documents on the left, confirm-and-decide on the right. */
export function VerificationReviewPage() {
  const { id } = useParams();
  const review = findVerificationReview(id ?? DEMO_IDS.verification);
  const revokeDialog = useUrlDialog('revoke');
  const priorityChip = VERIFICATION_PRIORITY_CHIP[review.priority];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <b className="text-h4">
            <Link to={paths.worker(DEMO_IDS.worker)} className="hover:text-primary">
              {review.workerName}
            </Link>{' '}
            · {review.checkType}
          </b>
          <StatusChip tone={VERIFICATION_STATUS_CHIP[review.status].tone}>
            {VERIFICATION_STATUS_CHIP[review.status].label} · claimed by you {review.claimedMinutesAgo} min
            ago
          </StatusChip>
          <StatusChip tone={priorityChip.tone}>{priorityChip.label}</StatusChip>
          <StatusChip tone="neutral">
            Attempt {review.attemptNumber} of {review.maxAttempts}
            {review.previousRejectReason && ` · earlier: REJECTED ${review.previousRejectReason}`}
          </StatusChip>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-fg-muted text-[13px]">
            <Timer aria-hidden className="inline size-4 align-[-3px]" /> Waiting {review.waitingHours} h
            {review.waitingHours > VERIFICATION_MAX_WAIT_HOURS &&
              ` · over ${VERIFICATION_MAX_WAIT_HOURS} h max`}
          </span>
          <RequirePermission permission="verification.review">
            <Button variant="secondary" size="sm" onClick={() => revokeDialog.openDialog()}>
              History &amp; revoke…
            </Button>
          </RequirePermission>
        </div>
      </div>

      {review.duplicateOf && (
        <AlertBanner tone="error">
          <b>Possible duplicate:</b> the same document number is on another worker,{' '}
          <b>{review.duplicateOf.workerName}</b> <CopyId id={review.duplicateOf.workerId} /> (
          {review.duplicateOf.checkType} VERIFIED, {review.duplicateOf.verifiedOn}). Approving will fail —
          reject as <b>DUPLICATE_DOCUMENT</b> unless the other record is wrong.
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1fr_430px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:[&>*]:h-[250px]">
            {review.documents.map((document) => (
              <DocumentPreview key={document.id} document={document} />
            ))}
          </div>
          <AlertBanner tone="neutral" icon={ReceiptText}>
            Each "View" makes a 60-second link and is saved in the audit log (VERIFICATION_DOCUMENT_VIEWED).
            Compare the face in the selfie with the photo on the card.
          </AlertBanner>
          <Card className="gap-2.5">
            <div className="flex items-center justify-between">
              <b className="text-h4">Names on record</b>
              <span className="text-fg-muted text-[13px]">used for NAME_MISMATCH</span>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-1 text-[13px]">
              <span>
                Profile name: <b>{review.workerName}</b>
              </span>
              <span>
                Bank holder (payout): <b>{review.bankHolderName}</b>
              </span>
              {review.previousRejectReason && (
                <span>
                  Earlier attempt: <b>REJECTED · {review.previousRejectReason}</b> ·{' '}
                  {review.previousAttemptOn}
                </span>
              )}
            </div>
          </Card>
        </div>
        <VerificationDecisionForm review={review} />
      </div>

      <RevokeVerificationDialog
        review={review}
        open={revokeDialog.isOpen}
        onClose={revokeDialog.closeDialog}
      />
    </>
  );
}

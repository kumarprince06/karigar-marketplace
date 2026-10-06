import { Ban, Check, CircleCheck, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button, Card, Field, Input, PermTag, Select, Textarea } from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import {
  VERIFICATION_REJECT_REASONS,
  type IdentityDocumentKind,
  type VerificationRejectReason,
  type VerificationReview,
} from '../types';
import { DocumentComparisonRow } from './DocumentComparisonRow';

const IDENTITY_DOCUMENT_KINDS: readonly IdentityDocumentKind[] = ['VOTER_ID', 'DRIVING_LICENCE', 'PASSPORT'];
const ADULT_AGE = 18;
const compactControlClassName = 'min-h-[34px] text-[13px]';

/** "Confirm what the card says": the reviewer re-types the fields, then approves the check or rejects with a reason. */
export function VerificationDecisionForm({ review }: { review: VerificationReview }) {
  const controlIdPrefix = useId();
  const [documentKind, setDocumentKind] = useState(review.typed.documentKind);
  const [nameOnCard, setNameOnCard] = useState(review.reviewerDraft.nameOnCard);
  const [yearOfBirth, setYearOfBirth] = useState(String(review.typed.yearOfBirth));
  const [documentNumber, setDocumentNumber] = useState(review.reviewerDraft.documentNumber);
  const [issuedOn, setIssuedOn] = useState(review.reviewerDraft.issuedOn);
  const [expiresOn, setExpiresOn] = useState('');
  const [rejectReason, setRejectReason] = useState<VerificationRejectReason>('BLURRY_IMAGE');
  const [rejectNote, setRejectNote] = useState('');

  const ageInYears = new Date().getFullYear() - Number(yearOfBirth);
  const isAdult = ageInYears >= ADULT_AGE;
  const AgeCheckIcon = isAdult ? Check : X;
  const ageHint = Number.isFinite(ageInYears) && (
    <span className="text-fg-subtle inline-flex items-center gap-1 whitespace-nowrap">
      · {ageInYears} yrs <AgeCheckIcon aria-hidden className="size-3.5" /> {isAdult ? '18+' : 'under 18'}
    </span>
  );

  return (
    <Card className="gap-2.5">
      <div className="flex items-center justify-between">
        <b className="text-h4">Confirm what the card says</b>
        <PermTag>v{review.version}</PermTag>
      </div>

      <div className="grid grid-cols-1 gap-x-2.5 gap-y-1.5 text-[13px] sm:grid-cols-[120px_1fr_1fr] sm:items-center">
        <span className="max-sm:hidden" />
        <span className="text-fg-muted text-[11px] font-bold uppercase max-sm:hidden">Worker typed</span>
        <span className="text-fg-muted text-[11px] font-bold uppercase max-sm:hidden">You confirm</span>

        <DocumentComparisonRow
          label="Document"
          controlId={`${controlIdPrefix}-kind`}
          typedValue={review.typed.documentKind}
        >
          <Select
            id={`${controlIdPrefix}-kind`}
            value={documentKind}
            onChange={(event) => setDocumentKind(event.target.value as IdentityDocumentKind)}
            className={compactControlClassName}
          >
            {IDENTITY_DOCUMENT_KINDS.map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </Select>
        </DocumentComparisonRow>
        <DocumentComparisonRow
          label="Name on card"
          controlId={`${controlIdPrefix}-name`}
          typedValue={review.typed.nameOnCard}
        >
          <Input
            id={`${controlIdPrefix}-name`}
            value={nameOnCard}
            onChange={(event) => setNameOnCard(event.target.value)}
            className={compactControlClassName}
          />
        </DocumentComparisonRow>
        <DocumentComparisonRow
          label="Year of birth"
          controlId={`${controlIdPrefix}-year`}
          typedValue={review.typed.yearOfBirth}
        >
          <Input
            id={`${controlIdPrefix}-year`}
            inputMode="numeric"
            value={yearOfBirth}
            onChange={(event) => setYearOfBirth(event.target.value)}
            trailing={ageHint}
            className={compactControlClassName}
          />
        </DocumentComparisonRow>
        <DocumentComparisonRow
          label="Number"
          controlId={`${controlIdPrefix}-number`}
          typedValue={<span className="font-mono">{review.typed.maskedNumber}</span>}
        >
          <Input
            id={`${controlIdPrefix}-number`}
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            className={`${compactControlClassName} font-mono`}
          />
        </DocumentComparisonRow>
        <DocumentComparisonRow label="Issued on" controlId={`${controlIdPrefix}-issued`} typedValue="—">
          <Input
            id={`${controlIdPrefix}-issued`}
            value={issuedOn}
            onChange={(event) => setIssuedOn(event.target.value)}
            className={compactControlClassName}
          />
        </DocumentComparisonRow>
        <DocumentComparisonRow label="Expires on" controlId={`${controlIdPrefix}-expires`} typedValue="—">
          <Input
            id={`${controlIdPrefix}-expires`}
            value={expiresOn}
            placeholder="none printed"
            onChange={(event) => setExpiresOn(event.target.value)}
            className={compactControlClassName}
          />
        </DocumentComparisonRow>
      </div>

      <p className="text-fg-muted text-[13px]">
        Only the masked number (last 4) and a hash are stored. Full number is never shown again.
      </p>

      <RequirePermission permission="verification.review">
        <Button block>
          <CircleCheck aria-hidden className="size-4" /> Approve ID proof
        </Button>
        <hr className="border-border" />
        <div className="flex items-center gap-2">
          <Select
            aria-label="Reject reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value as VerificationRejectReason)}
            className={`${compactControlClassName} flex-1`}
          >
            {VERIFICATION_REJECT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                Reject reason: {reason}
              </option>
            ))}
          </Select>
          <Button variant="dangerOutline" size="sm">
            Reject
          </Button>
        </div>
        {rejectReason === 'OTHER' && (
          <Field label="Note" hint="(required for OTHER)">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
              />
            )}
          </Field>
        )}
        <p className="text-fg-muted text-[13px]">
          Note box appears only for OTHER. Reasons: {VERIFICATION_REJECT_REASONS.join(' · ')}
        </p>
        <Button variant="danger" size="sm" block>
          <Ban aria-hidden className="size-4" /> Aadhaar card uploaded — reject &amp; delete file now
        </Button>
      </RequirePermission>
    </Card>
  );
}

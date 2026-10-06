import { CircleCheck, EyeOff, Trash } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Input, PermTag, Select, Stars } from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { REVIEW_MODERATION_REASONS, type ModeratedReview, type ReviewModerationReason } from '../types';
import { DirectionArrow } from './DirectionArrow';

/** Moderate one review: approve, hide (keeps rating), remove (drops from rating) or hide the worker reply. */
export function ReviewModerationPanel({ review }: { review: ModeratedReview }) {
  const [reason, setReason] = useState<ReviewModerationReason>(
    review.flagReason ?? review.reports?.reason ?? 'CONTACT_DETAILS',
  );
  const [note, setNote] = useState(review.moderatorNote ?? '');

  return (
    <Card stripe="primary" className="gap-3">
      <div className="flex items-center justify-between">
        <b className="text-h4">Moderate</b>
        <PermTag>review.moderate</PermTag>
      </div>
      <p className="text-fg-muted text-[13px]">
        {review.authorName} <DirectionArrow /> {review.targetName} · <Stars value={review.rating} />
      </p>
      <RequirePermission permission="review.moderate">
        <div className="flex flex-col gap-2">
          <Button block>
            <CircleCheck aria-hidden className="size-4" /> Approve &amp; publish
          </Button>
          <Button variant="secondary" block>
            <EyeOff aria-hidden className="size-4" /> Hide (keeps rating)
          </Button>
          <Button variant="dangerOutline" block>
            <Trash aria-hidden className="size-4" /> Remove (drops from rating)
          </Button>
          <Button variant="ghost" block disabled={!review.workerReply}>
            Hide worker reply only
          </Button>
        </div>
        <Field label="Reason" hint="(not needed for approve)">
          {({ id }) => (
            <Select
              id={id}
              value={reason}
              onChange={(event) => setReason(event.target.value as ReviewModerationReason)}
            >
              {REVIEW_MODERATION_REASONS.map((moderationReason) => (
                <option key={moderationReason}>{moderationReason}</option>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-fg-muted text-[13px]">{REVIEW_MODERATION_REASONS.join(' · ')}</p>
        <Field label="Note">
          {({ id }) => <Input id={id} value={note} onChange={(event) => setNote(event.target.value)} />}
        </Field>
      </RequirePermission>
    </Card>
  );
}

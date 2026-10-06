import { Flag } from 'lucide-react';
import { CopyId, Stars, StatusChip } from '@/components/ui';
import { mergeClassNames } from '@/lib/merge-class-names';
import { REVIEW_STATUS_CHIP } from '../status-chip-presentation';
import type { ModeratedReview } from '../types';
import { DirectionArrow } from './DirectionArrow';
import { HighlightedReviewText } from './HighlightedReviewText';

/** One review in the moderation list. The whole card is a radio option, so a click anywhere selects it. */
export function ModeratedReviewCard({
  review,
  isSelected,
  onSelect,
}: {
  review: ModeratedReview;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusChip = REVIEW_STATUS_CHIP[review.status];
  return (
    <label
      className={mergeClassNames(
        'bg-surface shadow-e1 has-focus-visible:shadow-focus flex cursor-pointer flex-col gap-2 rounded-lg p-4',
        isSelected ? 'border-primary border-2' : 'border-border border',
      )}
    >
      <input
        type="radio"
        name="moderated-review"
        checked={isSelected}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Stars value={review.rating} />
          <b>
            {review.direction === 'CUSTOMER_TO_WORKER' ? (
              <>
                Customer <DirectionArrow /> worker
              </>
            ) : (
              <>
                Worker <DirectionArrow /> customer
              </>
            )}
          </b>
          <span className="text-fg-muted text-[13px]">
            {review.authorName} <DirectionArrow /> {review.targetName} · job <CopyId id={review.jobId} />
          </span>
        </div>
        <StatusChip tone={statusChip.tone}>
          {statusChip.label}
          {review.flagReason && ` · ${review.flagReason}`}
        </StatusChip>
      </div>
      <p>
        <span lang={review.language}>
          "<HighlightedReviewText text={review.text} flaggedPhrases={review.flaggedPhrases} />"
        </span>{' '}
        <span className="text-fg-subtle">· {review.language}</span>
      </p>
      {review.workerReply && (
        <p className="border-accent border-l-[3px] py-1 pl-2.5 text-[13px]">
          <b>Worker reply:</b> "
          <HighlightedReviewText
            text={review.workerReply.text}
            flaggedPhrases={review.workerReply.flaggedPhrases}
          />
          "
        </p>
      )}
      {review.reports && (
        <div>
          <StatusChip tone="error">
            <Flag aria-hidden className="size-3.5" /> {review.reports.count} report · {review.reports.reason}
            {review.reports.onReply && ' (on reply)'}
          </StatusChip>
        </div>
      )}
    </label>
  );
}

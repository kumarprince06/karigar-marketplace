import { Flag, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, Tabs } from '@/components/ui';
import { ModeratedReviewCard } from '../components/ModeratedReviewCard';
import { ReviewModerationPanel } from '../components/ReviewModerationPanel';
import { MODERATED_REVIEWS } from '../mock-data';
import type { ReviewModerationQueue } from '../types';

/** A-04g. Reviews held by the content filter, and published reviews someone reported (LLD-012). */
export function ReviewModerationPage() {
  const [activeQueue, setActiveQueue] = useState<ReviewModerationQueue>('MODERATION');
  const [selectedReviewId, setSelectedReviewId] = useState(MODERATED_REVIEWS[0]?.id);

  const reviewsInQueue = MODERATED_REVIEWS.filter((review) => review.queue === activeQueue);
  const selectedReview = reviewsInQueue.find((review) => review.id === selectedReviewId) ?? reviewsInQueue[0];
  const countInQueue = (queue: ReviewModerationQueue) =>
    MODERATED_REVIEWS.filter((review) => review.queue === queue).length;

  return (
    <>
      <Tabs
        label="Moderation queue"
        value={activeQueue}
        onChange={setActiveQueue}
        items={[
          {
            id: 'MODERATION',
            icon: ShieldAlert,
            label: 'Flagged by filter',
            count: countInQueue('MODERATION'),
          },
          { id: 'REPORTED', icon: Flag, label: 'Reported', count: countInQueue('REPORTED') },
        ]}
      />
      {selectedReview ? (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <fieldset className="m-0 flex min-w-0 flex-1 flex-col gap-3 border-0 p-0">
            <legend className="sr-only">Reviews to moderate</legend>
            {reviewsInQueue.map((review) => (
              <ModeratedReviewCard
                key={review.id}
                review={review}
                isSelected={review.id === selectedReview.id}
                onSelect={() => setSelectedReviewId(review.id)}
              />
            ))}
          </fieldset>
          <aside className="xl:w-[360px] xl:shrink-0">
            <ReviewModerationPanel key={selectedReview.id} review={selectedReview} />
          </aside>
        </div>
      ) : (
        <EmptyState title="Nothing to moderate">New flags and reports show up here.</EmptyState>
      )}
    </>
  );
}

import { Clock } from 'lucide-react';
import { Card, Timeline } from '@/components/ui';
import { formatDateTime } from '@/lib/formatters';
import type { BookingTimelineEvent } from '../types';

/** Booking, job and visit events in one timeline. */
export function BookingTimelineCard({ events }: { events: readonly BookingTimelineEvent[] }) {
  return (
    <Card className="gap-1">
      <h3 className="text-h4 flex items-center gap-1.5 font-semibold">
        <Clock aria-hidden className="size-4" /> Timeline
      </h3>
      <div className="text-[13px]">
        <Timeline
          items={events.map((event) => ({
            title: event.title,
            meta: event.note ? `${formatDateTime(event.at)} · ${event.note}` : formatDateTime(event.at),
            state: event.isCurrent ? 'now' : 'done',
          }))}
        />
      </div>
    </Card>
  );
}

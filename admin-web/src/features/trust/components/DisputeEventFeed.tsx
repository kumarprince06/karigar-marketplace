import { Camera, Video } from 'lucide-react';
import { mergeClassNames } from '@/lib/merge-class-names';
import type { DisputeStatementEvent } from '../types';

/** Left edge colour tells the parties apart; the author name says it in words too. */
const PARTY_BORDER_CLASS_NAME: Record<DisputeStatementEvent['party'], string> = {
  CUSTOMER: 'border-info',
  WORKER: 'border-accent',
  AGENT: 'border-primary',
};

const pluralise = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function attachmentSummary(event: DisputeStatementEvent) {
  const attachments = [
    event.photos ? { icon: Camera, label: pluralise(event.photos, 'photo') } : undefined,
    event.videos ? { icon: Video, label: pluralise(event.videos, 'video') } : undefined,
  ].filter((attachment) => attachment !== undefined);
  return attachments.map((attachment, attachmentIndex) => (
    <span key={attachment.label}>
      {attachmentIndex > 0 && ' · '}
      <attachment.icon aria-hidden className="inline size-3.5 align-[-2px]" /> {attachment.label}
    </span>
  ));
}

/** Statements both parties see, oldest first. */
export function DisputeEventFeed({ events }: { events: readonly DisputeStatementEvent[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {events.map((event) => (
        <li
          key={event.id}
          className={mergeClassNames(
            'border-l-[3px] py-1 pl-2.5 text-[13px]',
            PARTY_BORDER_CLASS_NAME[event.party],
          )}
        >
          {event.author && (
            <>
              <b>{event.author}</b> · {event.at}
              <br />
            </>
          )}
          {event.text}
          {attachmentSummary(event)}
          {!event.author && event.at && ` · ${event.at}`}
        </li>
      ))}
    </ol>
  );
}

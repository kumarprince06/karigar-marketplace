import { Eye, Hourglass, ZoomIn } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { mergeClassNames } from '@/lib/merge-class-names';
import type { VerificationDocument } from '../types';

const SIGNED_LINK_SECONDS = 60;

const formatSecondsLeft = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * A worker's uploaded document. Static design: a gradient placeholder stands in for the image.
 * "View" asks for a 60 s signed link (audited as VERIFICATION_DOCUMENT_VIEWED).
 */
export function DocumentPreview({ document }: { document: VerificationDocument }) {
  const [linkSecondsLeft, setLinkSecondsLeft] = useState(document.linkSecondsLeft);
  const isOpen = linkSecondsLeft !== undefined;

  return (
    <figure
      className={mergeClassNames(
        'border-border relative m-0 grid min-h-[200px] place-items-center rounded-md border bg-linear-135',
        isOpen ? 'from-fg-muted to-ink text-white' : 'from-muted to-border text-fg-subtle',
      )}
    >
      <figcaption className="bg-surface text-fg-muted absolute top-2 left-2 rounded-sm px-2 py-px text-xs font-bold">
        {document.caption}
      </figcaption>
      <document.icon aria-hidden className="size-11" strokeWidth={1.5} />
      <div className="absolute right-2 bottom-2 left-2 text-xs">
        {isOpen ? (
          <div className="flex items-center justify-between text-white">
            <span>
              <Hourglass aria-hidden className="inline size-3.5 align-[-2px]" /> link expires in{' '}
              {formatSecondsLeft(linkSecondsLeft)}
            </span>
            <button
              type="button"
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 hover:underline"
            >
              <ZoomIn aria-hidden className="size-3.5" /> Zoom
            </button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" block onClick={() => setLinkSecondsLeft(SIGNED_LINK_SECONDS)}>
            <Eye aria-hidden className="size-4" /> View · 60 s link
          </Button>
        )}
      </div>
    </figure>
  );
}

import { ArrowRight } from 'lucide-react';

/** "A → B" arrow: drawn for sighted users, read as "to" by screen readers. */
export function DirectionArrow() {
  return (
    <>
      <ArrowRight aria-hidden className="inline size-3.5 align-[-2px]" />
      <span className="sr-only"> to </span>
    </>
  );
}

import { useNavigation } from 'react-router';

/** Thin animated bar across the top while the next page's code or data is loading. */
export function NavigationProgressBar() {
  const isNavigating = useNavigation().state !== 'idle';
  if (!isNavigating) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="bg-primary-subtle absolute inset-x-0 top-0 z-20 h-[3px] overflow-hidden"
    >
      <div className="bg-warm motion-safe:animate-progress-indeterminate h-full w-full origin-left" />
    </div>
  );
}

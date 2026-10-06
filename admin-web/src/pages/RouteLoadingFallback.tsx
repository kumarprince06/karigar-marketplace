import { Hammer } from 'lucide-react';
import { IconTile, LoadingSpinner } from '@/components/ui';

/** Full-screen branded loader shown while the first screen's code downloads. */
export function RouteLoadingFallback() {
  return (
    <div className="bg-brand-soft grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative grid size-[76px] place-items-center">
          <IconTile icon={Hammer} tone="brand" size="md" className="shadow-primary" />
          <div className="absolute inset-0 grid place-items-center">
            <LoadingSpinner size="lg" label="Loading Karigar Ops" className="text-primary size-[76px]" />
          </div>
        </div>
        <p aria-hidden className="text-fg-muted text-sm font-semibold motion-safe:animate-pulse">
          Loading Karigar Ops…
        </p>
      </div>
    </div>
  );
}

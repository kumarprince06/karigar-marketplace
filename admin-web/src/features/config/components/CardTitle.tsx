import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Card heading with a leading icon (the mockups pair each card title with an icon). */
export function CardTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="text-h4 flex min-w-0 items-center gap-1.5 font-semibold">
      <Icon aria-hidden className="text-primary size-[18px] shrink-0" />
      <span className="min-w-0">{children}</span>
    </h3>
  );
}

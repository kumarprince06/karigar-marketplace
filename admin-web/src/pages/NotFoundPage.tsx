import { Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';
import { paths } from '@/config/route-paths';

export function NotFoundPage() {
  return (
    <div className="bg-brand-soft grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3">
        <EmptyState icon={Compass} title="Page not found">
          The link may be old, or the record was removed.
        </EmptyState>
        <ButtonLink to={paths.ops}>Back to ops queues</ButtonLink>
      </div>
    </div>
  );
}

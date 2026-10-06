import type { ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** In-page heading row (the top bar holds the breadcrumb, this holds the page's own title and actions). */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={mergeClassNames('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 className="text-h2 font-semibold">{title}</h2>
        {description && <p className="text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

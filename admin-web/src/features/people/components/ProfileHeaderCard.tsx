import type { ReactNode } from 'react';
import { Avatar, Card } from '@/components/ui';

interface ProfileHeaderCardProps {
  initials: string;
  name: string;
  /** Status chips and pills shown after the name. */
  badges?: ReactNode;
  /** Masked id / contact line under the name. */
  details?: ReactNode;
  actions?: ReactNode;
}

/** Brand header at the top of customer and worker detail pages. */
export function ProfileHeaderCard({ initials, name, badges, details, actions }: ProfileHeaderCardProps) {
  return (
    <Card variant="brand" className="flex-row flex-wrap items-center gap-4 px-4 py-[18px] md:px-5">
      <Avatar initials={initials} size="lg" tone="glass" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h2 font-semibold break-words">{name}</h2>
          {badges}
        </div>
        {details && (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px]">{details}</div>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:shrink-0">{actions}</div>
      )}
    </Card>
  );
}

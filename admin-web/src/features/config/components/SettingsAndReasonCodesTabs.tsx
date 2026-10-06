import { Settings, Tag } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs } from '@/components/ui';
import { paths } from '@/config/route-paths';

/** Settings (A-06i) and Reason codes (A-06j) tabs with a slot on the right. */
export function SettingsAndReasonCodesTabs({ aside }: { aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <Tabs
        label="Platform settings"
        className="min-w-0 border-0"
        items={[
          { id: 'settings', label: 'Settings', icon: Settings, to: paths.settings },
          { id: 'reason-codes', label: 'Reason codes', icon: Tag, to: paths.reasonCodes },
        ]}
      />
      {aside}
    </div>
  );
}

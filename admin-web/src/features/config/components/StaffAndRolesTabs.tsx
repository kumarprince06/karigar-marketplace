import { Shield, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs } from '@/components/ui';
import { paths } from '@/config/route-paths';
import { STAFF_MEMBERS } from '../staff-and-settings-mock-data';

/** Staff (A-06g) and Roles (A-06h) tabs with a slot on the right for the page's action or note. */
export function StaffAndRolesTabs({ aside }: { aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <Tabs
        label="Staff and roles"
        className="min-w-0 border-0"
        items={[
          { id: 'staff', label: 'Staff', icon: Users, count: STAFF_MEMBERS.length, to: paths.staff },
          { id: 'roles', label: 'Roles (read-only)', icon: Shield, to: paths.roles },
        ]}
      />
      {aside}
    </div>
  );
}

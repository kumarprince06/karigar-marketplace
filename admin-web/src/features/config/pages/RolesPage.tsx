import { Lock } from 'lucide-react';
import { StatusChip } from '@/components/ui';
import { RolePermissionMatrix } from '../components/RolePermissionMatrix';
import { StaffAndRolesTabs } from '../components/StaffAndRolesTabs';

/** A-06h roles & permissions. Read-only: roles change only through a code migration. */
export function RolesPage() {
  return (
    <>
      <StaffAndRolesTabs
        aside={
          <StatusChip className="whitespace-normal">
            <Lock aria-hidden className="size-3.5 shrink-0" /> Roles change only through a code migration
          </StatusChip>
        }
      />
      <RolePermissionMatrix />
    </>
  );
}

import { Check } from 'lucide-react';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from '@/features/auth';

const grantedPermissionsByRole = new Map(ROLES.map((role) => [role, new Set(ROLE_PERMISSIONS[role])]));

const headerCellClassName =
  'border-border bg-muted text-fg-muted border-b px-2.5 py-1 text-[11px] font-semibold';

/** Read-only role × permission matrix generated from the seeded role_permissions (LLD-020 §4.1). */
export function RolePermissionMatrix() {
  return (
    <div
      role="region"
      aria-label="Role permission matrix"
      // A scrollable region must be reachable by keyboard (axe scrollable-region-focusable).
      tabIndex={0}
      className="border-border bg-surface overflow-x-auto rounded-lg border"
    >
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">Permissions granted to each staff role</caption>
        <thead>
          <tr>
            <th scope="col" className={`${headerCellClassName} text-left`}>
              Permission
            </th>
            {ROLES.map((role) => (
              <th key={role} scope="col" className={`${headerCellClassName} text-center`}>
                {role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((permission) => (
            <tr key={permission} className="border-border border-b last:border-b-0">
              <th scope="row" className="px-2.5 py-1 text-left font-mono font-normal">
                {permission}
              </th>
              {ROLES.map((role) =>
                grantedPermissionsByRole.get(role)?.has(permission) ? (
                  <td key={role} className="text-success px-2.5 py-1 text-center font-extrabold">
                    <Check aria-hidden className="mx-auto size-4" strokeWidth={3} />
                    <span className="sr-only">granted</span>
                  </td>
                ) : (
                  <td key={role} className="text-border px-2.5 py-1 text-center">
                    <span aria-hidden>·</span>
                    <span className="sr-only">not granted</span>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

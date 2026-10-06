import type { ReactNode } from 'react';
import type { Permission } from './permissions';
import { useHasPermissions } from './useSession';

interface RequirePermissionProps {
  permission: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

/** Renders children only when the caller holds the permission(s). Hiding is UX; the API still enforces. */
export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const allowed = useHasPermissions(...(Array.isArray(permission) ? permission : [permission]));
  return allowed ? children : fallback;
}

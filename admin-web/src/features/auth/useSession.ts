import { use } from 'react';
import type { Permission } from './permissions';
import { SessionContext } from './session-context';

export function useSession() {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** True when the current staff member holds every listed permission. */
export function useHasPermissions(...required: Permission[]) {
  const { session } = useSession();
  return required.every((p) => session.permissions.has(p));
}

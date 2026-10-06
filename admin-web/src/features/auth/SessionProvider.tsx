import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ROLE_PERMISSIONS, ROLES, type Role } from './permissions';
import { SessionContext, type SessionContextValue } from './session-context';
import { PREVIEW_ROLE_STORAGE_KEY, SIGNED_IN_STORAGE_KEY } from './session-storage-keys';

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): state simply lasts until reload.
  }
}

/** Design preview starts as SUPER_ADMIN so every screen is reachable; the sidebar picker narrows it. */
function readStoredPreviewRole(): Role {
  const storedRole = readStorage(PREVIEW_ROLE_STORAGE_KEY);
  return ROLES.find((role) => role === storedRole) ?? 'SUPER_ADMIN';
}

/**
 * Static design: sign-in state and the preview role live in sessionStorage (per tab, gone when the tab closes).
 * The real app replaces both with the HttpOnly-cookie session and GET /api/v1/admin/me (LLD-002 web note).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readStoredPreviewRole);
  const [isSignedIn, setIsSignedIn] = useState(() => readStorage(SIGNED_IN_STORAGE_KEY) === 'true');

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole);
    writeStorage(PREVIEW_ROLE_STORAGE_KEY, nextRole);
  }, []);

  const completeSignIn = useCallback(() => {
    setIsSignedIn(true);
    writeStorage(SIGNED_IN_STORAGE_KEY, 'true');
  }, []);

  const signOut = useCallback(() => {
    setIsSignedIn(false);
    writeStorage(SIGNED_IN_STORAGE_KEY, null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session: {
        name: 'Priya Sen',
        initials: 'PS',
        email: 'priya.sen@karigar.in',
        role,
        zone: 'Howrah',
        mfaWindowOpenUntil: '21:40',
        permissions: new Set(ROLE_PERMISSIONS[role]),
      },
      isSignedIn,
      completeSignIn,
      signOut,
      setRole,
    }),
    [role, isSignedIn, completeSignIn, signOut, setRole],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

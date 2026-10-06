import { createContext } from 'react';
import type { Permission, Role } from './permissions';

export interface StaffSession {
  name: string;
  initials: string;
  email: string;
  role: Role;
  zone: string;
  mfaWindowOpenUntil: string;
  permissions: ReadonlySet<Permission>;
}

export interface SessionContextValue {
  session: StaffSession;
  /** True once the staff member has passed password + MFA (LLD-020 D2). */
  isSignedIn: boolean;
  /** Called by the MFA step on a valid code; opens the console. */
  completeSignIn: () => void;
  signOut: () => void;
  /** Static design only: lets reviewers preview what each role sees. Replaced by GET /admin/me. */
  setRole: (role: Role) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

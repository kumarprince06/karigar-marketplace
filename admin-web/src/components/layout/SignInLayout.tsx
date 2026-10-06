import { Outlet } from 'react-router';

/** Full-screen layout for login and MFA screens (no sidebar, no session yet). */
export function SignInLayout() {
  return (
    <main className="bg-brand-soft flex min-h-screen">
      <Outlet />
    </main>
  );
}

import { Outlet } from 'react-router';
import { ColorThemeToggle } from './ColorThemeToggle';

/** Full-screen layout for login and MFA screens (no sidebar, no session yet). */
export function SignInLayout() {
  return (
    <main className="bg-brand-soft relative flex min-h-screen">
      <ColorThemeToggle className="bg-surface/80 shadow-e1 absolute top-3 right-3 z-10" />
      <Outlet />
    </main>
  );
}

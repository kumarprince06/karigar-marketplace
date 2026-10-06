import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useMatches } from 'react-router';
import { EmptyState, PermTag } from '@/components/ui';
import { buildLoginPathWithRedirect, useSession } from '@/features/auth';
import type { RouteHandle } from '@/app/route-handle';
import { SidebarNavigation } from './SidebarNavigation';
import { NavigationProgressBar } from './NavigationProgressBar';
import { TopBar } from './TopBar';

/** Authenticated console layout: sidebar (drawer below lg), top bar, scrollable page, per-route permission check. */
export function AuthenticatedLayout() {
  const { session, isSignedIn } = useSession();
  const location = useLocation();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const requiredPermission = useMatches()
    .map((match) => (match.handle as RouteHandle | undefined)?.permission)
    .filter(Boolean)
    .at(-1);
  const hasAccess = !requiredPermission || session.permissions.has(requiredPermission);

  useEffect(() => {
    if (!isNavigationOpen) return;
    const closeNavigationOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNavigationOpen(false);
    };
    window.addEventListener('keydown', closeNavigationOnEscape);
    return () => window.removeEventListener('keydown', closeNavigationOnEscape);
  }, [isNavigationOpen]);

  if (!isSignedIn) {
    return <Navigate to={buildLoginPathWithRedirect(location.pathname + location.search)} replace />;
  }

  return (
    <div className="bg-canvas flex h-dvh overflow-hidden">
      <a
        href="#main"
        className="focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2"
      >
        Skip to content
      </a>
      <SidebarNavigation isDrawerOpen={isNavigationOpen} onCloseDrawer={() => setIsNavigationOpen(false)} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <NavigationProgressBar />
        <TopBar isNavigationOpen={isNavigationOpen} onOpenNavigation={() => setIsNavigationOpen(true)} />
        <main
          id="main"
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6 md:py-5 [&>*]:shrink-0"
        >
          {hasAccess ? (
            <Outlet />
          ) : (
            <EmptyState icon={Lock} title="You don't have access to this page">
              It needs <PermTag>{requiredPermission}</PermTag>. Ask a Super Admin if your role should include
              it.
            </EmptyState>
          )}
        </main>
      </div>
    </div>
  );
}

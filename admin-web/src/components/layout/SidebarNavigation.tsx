import { ChartLine, ExternalLink, Hammer, LogOut, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import { Avatar } from '@/components/ui';
import { SIDEBAR_NAVIGATION } from '@/config/sidebar-navigation';
import { GRAFANA_URL, paths } from '@/config/route-paths';
import { ROLES, useSession, type Role } from '@/features/auth';
import { mergeClassNames } from '@/lib/merge-class-names';

const sidebarLinkClassName =
  'flex min-h-9 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-white/10';

interface SidebarNavigationProps {
  /** Below the lg breakpoint the sidebar is an off-canvas drawer. */
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
}

export function SidebarNavigation({ isDrawerOpen, onCloseDrawer }: SidebarNavigationProps) {
  const { session, setRole, signOut } = useSession();
  const navigate = useNavigate();

  const handleLogOutClick = () => {
    signOut();
    navigate(paths.login, { replace: true });
  };

  const visibleGroups = SIDEBAR_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => session.permissions.has(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {isDrawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onCloseDrawer}
          className="bg-ink/50 fixed inset-0 z-30 lg:hidden"
        />
      )}
      <aside
        id="sidebar-navigation"
        className={mergeClassNames(
          'bg-brand text-sidebar-fg fixed inset-y-0 left-0 z-40 flex w-[232px] shrink-0 flex-col gap-px overflow-y-auto px-2.5 py-4 transition-transform',
          'lg:static lg:translate-x-0',
          isDrawerOpen ? 'shadow-e3 translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-2.5 pt-1.5 pb-3.5">
          <p className="flex items-center gap-2 text-[17px] font-bold text-white">
            <Hammer aria-hidden className="size-5" /> Karigar Ops
          </p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onCloseDrawer}
            className="grid size-9 place-items-center rounded-lg text-white hover:bg-white/10 lg:hidden"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-px">
          {visibleGroups.map((group, groupIndex) => (
            <div key={group.title ?? groupIndex} className="flex flex-col gap-px">
              {group.title && (
                <p className="text-sidebar-group px-2.5 pt-3 pb-1 text-[11px] tracking-[.06em] uppercase">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onCloseDrawer}
                  className={({ isActive }) =>
                    mergeClassNames(sidebarLinkClassName, isActive && 'bg-white/12 font-semibold text-white')
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon aria-hidden className="size-4" />
                    {item.label}
                  </span>
                  {item.count !== undefined && (
                    <span className="bg-accent text-ink rounded-[10px] px-[7px] text-xs font-bold">
                      {item.count}
                      <span className="sr-only"> waiting</span>
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="flex-1" />

        <a
          href={GRAFANA_URL}
          target="_blank"
          rel="noreferrer"
          className={mergeClassNames(sidebarLinkClassName, 'mt-1 border border-dashed border-white/35')}
        >
          <span className="flex items-center gap-2.5">
            <ChartLine aria-hidden className="size-4" /> Grafana
          </span>
          <ExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>

        <div className="mt-1.5 flex items-center gap-2 rounded-[10px] bg-white/10 p-2.5 text-xs text-white">
          <Avatar initials={session.initials} tone="warm" size="sm" />
          <div className="min-w-0 flex-1">
            <b className="block">{session.name}</b>
            {/* Design preview only: switch role to see what each role's sidebar and pages show. */}
            <label className="sr-only" htmlFor="preview-role">
              Preview as role
            </label>
            <select
              id="preview-role"
              value={session.role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="w-full cursor-pointer bg-transparent text-xs text-white/80 outline-none"
            >
              {ROLES.map((role) => (
                <option key={role} value={role} className="text-fg">
                  {role}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleLogOutClick}
            aria-label="Log out"
            title="Log out"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-white/15"
          >
            <LogOut aria-hidden className="size-4" />
          </button>
        </div>
      </aside>
    </>
  );
}

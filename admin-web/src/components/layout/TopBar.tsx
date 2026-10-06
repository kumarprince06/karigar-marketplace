import { MapPin, Menu, Search, ShieldCheck } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useMatches, useNavigate } from 'react-router';
import { Avatar, Input, StatusChip } from '@/components/ui';
import { paths } from '@/config/route-paths';
import { useSession } from '@/features/auth';
import { mergeClassNames } from '@/lib/merge-class-names';
import type { RouteHandle } from '@/app/route-handle';

interface TopBarProps {
  isNavigationOpen: boolean;
  onOpenNavigation: () => void;
}

export function TopBar({ isNavigationOpen, onOpenNavigation }: TopBarProps) {
  const { session } = useSession();
  const navigate = useNavigate();
  const breadcrumbs = useMatches().flatMap((match) => {
    const crumb = (match.handle as RouteHandle | undefined)?.crumb;
    if (!crumb) return [];
    return [{ label: typeof crumb === 'function' ? crumb(match.params) : crumb, to: match.pathname }];
  });

  return (
    <header className="border-border bg-surface flex h-[60px] shrink-0 items-center gap-3 border-b px-4 md:px-6">
      <button
        type="button"
        aria-label="Open menu"
        aria-controls="sidebar-navigation"
        aria-expanded={isNavigationOpen}
        onClick={onOpenNavigation}
        className="hover:bg-muted -ml-2 grid size-10 shrink-0 place-items-center rounded-lg lg:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </button>

      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold md:text-xl">
        {breadcrumbs.map((breadcrumb, index) => (
          <Fragment key={breadcrumb.to}>
            {index > 0 && (
              <span
                className={mergeClassNames(
                  'text-fg-subtle',
                  index === breadcrumbs.length - 1 && 'max-md:hidden',
                )}
              >
                {' › '}
              </span>
            )}
            {index < breadcrumbs.length - 1 ? (
              <Link to={breadcrumb.to} className="hover:text-primary max-md:hidden">
                {breadcrumb.label}
              </Link>
            ) : (
              breadcrumb.label
            )}
          </Fragment>
        ))}
      </h1>

      <form
        role="search"
        className="w-[280px] max-md:hidden"
        onSubmit={(event) => {
          event.preventDefault();
          const query = new FormData(event.currentTarget).get('q');
          navigate(`${paths.users}?q=${encodeURIComponent(String(query ?? ''))}`);
        }}
      >
        <Input
          name="q"
          type="search"
          leading={<Search className="size-4" />}
          placeholder="Phone, email, id or name…"
          aria-label="Find a user"
          className="min-h-[38px]"
        />
      </form>
      <Link
        to={paths.users}
        aria-label="Find a user"
        className="hover:bg-muted grid size-10 place-items-center rounded-lg md:hidden"
      >
        <Search aria-hidden className="size-5" />
      </Link>

      <StatusChip tone="accent" className="max-xl:hidden">
        <MapPin aria-hidden className="size-3.5" /> {session.zone}
      </StatusChip>
      <StatusChip tone="success" className="max-xl:hidden">
        <ShieldCheck aria-hidden className="size-3.5" /> MFA · until {session.mfaWindowOpenUntil}
      </StatusChip>
      <Avatar initials={session.initials} size="sm" />
    </header>
  );
}

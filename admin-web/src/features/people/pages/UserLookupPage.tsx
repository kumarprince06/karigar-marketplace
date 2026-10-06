import { Ban, Lightbulb, Scale, Search, User, Wrench } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  AlertBanner,
  ArrowLink,
  CopyId,
  DataTable,
  EmptyState,
  Masked,
  StatusChip,
  type Column,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { UserSearchForm } from '../components/UserSearchForm';
import { detectSearchQueryKind, maskEmail, maskPhone, searchUsers } from '../mock-data';
import { getStatusTone } from '../status-tones';
import type { UserSearchResult, UserTypeFilter } from '../types';

/** Design preview: with no ?q= the page shows the mockup's "Rin" search instead of an empty prompt. */
const DESIGN_PREVIEW_QUERY = 'Rin';

const TYPE_FILTERS: readonly UserTypeFilter[] = ['ALL', 'CUSTOMER', 'WORKER'];

const QUERY_KIND_DESCRIPTIONS = {
  NAME: 'name starting',
  PHONE: 'phone',
  EMAIL: 'email',
  ID: 'id',
} as const;

function getProfilePath(user: UserSearchResult): string {
  return user.profileTypes.includes('CUSTOMER') ? paths.customer(user.id) : paths.worker(user.id);
}

const RESULT_COLUMNS: Column<UserSearchResult>[] = [
  { id: 'name', header: 'Name', cell: (user) => <b>{user.name}</b> },
  {
    id: 'type',
    header: 'Type',
    cell: (user) => (
      <span className="flex flex-wrap gap-1">
        {user.profileTypes.includes('CUSTOMER') && (
          <StatusChip tone="info">
            <User aria-hidden className="inline size-4 align-text-bottom" /> Customer
          </StatusChip>
        )}
        {user.profileTypes.includes('WORKER') && (
          <StatusChip tone="accent">
            <Wrench aria-hidden className="inline size-4 align-text-bottom" /> Worker
          </StatusChip>
        )}
      </span>
    ),
  },
  { id: 'id', header: 'User id', cell: (user) => <CopyId id={user.id} /> },
  { id: 'phone', header: 'Phone', cell: (user) => <Masked>{maskPhone(user.phone)}</Masked> },
  { id: 'email', header: 'Email', cell: (user) => <Masked>{maskEmail(user.email)}</Masked> },
  { id: 'area', header: 'Area', cell: (user) => user.area },
  {
    id: 'account',
    header: 'Account',
    cell: (user) => <StatusChip tone={getStatusTone(user.accountStatus)}>{user.accountStatus}</StatusChip>,
  },
  {
    id: 'dispute',
    header: 'Open dispute',
    cell: (user) =>
      user.openDisputeCount > 0 ? (
        <StatusChip tone="warning">
          <Scale aria-hidden className="inline size-4 align-text-bottom" /> {user.openDisputeCount}
        </StatusChip>
      ) : (
        '—'
      ),
  },
  {
    id: 'restrictions',
    header: 'Restrictions',
    cell: (user) =>
      user.restrictions.length > 0
        ? user.restrictions.map((restriction) => (
            <StatusChip key={restriction} tone="error">
              <Ban aria-hidden className="inline size-4 align-text-bottom" /> {restriction}
            </StatusChip>
          ))
        : '—',
  },
  {
    id: 'open',
    header: <span className="sr-only">Open</span>,
    cell: (user) => (
      <ArrowLink to={getProfilePath(user)} aria-label={`Open ${user.name}`}>
        Open
      </ArrowLink>
    ),
  },
];

/** A-02a: search-first lookup. No paged list of everyone, no export (LLD-020 §4.2). */
export function UserLookupPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? DESIGN_PREVIEW_QUERY;
  const requestedTypeFilter = searchParams.get('type') as UserTypeFilter | null;
  const typeFilter =
    requestedTypeFilter && TYPE_FILTERS.includes(requestedTypeFilter) ? requestedTypeFilter : 'ALL';
  const trimmedQuery = query.trim();
  const results = trimmedQuery ? searchUsers(trimmedQuery, typeFilter) : null;

  const handleSearch = (nextQuery: string, nextTypeFilter: UserTypeFilter) =>
    setSearchParams({ q: nextQuery.trim(), type: nextTypeFilter });

  return (
    <>
      <UserSearchForm
        key={`${query}|${typeFilter}`}
        initialQuery={query}
        initialTypeFilter={typeFilter}
        onSearch={handleSearch}
      />

      {!trimmedQuery ? (
        <EmptyState icon={Search} title="Search for a customer or worker">
          Type an exact phone, email or id, or the first 3 letters of a name.
        </EmptyState>
      ) : results === null ? (
        <AlertBanner tone="warning">
          Name search needs at least 3 letters. Phone and email must be an exact match.
        </AlertBanner>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-fg-muted text-[13px]">
              {results.length} result{results.length === 1 ? '' : 's'} for{' '}
              {QUERY_KIND_DESCRIPTIONS[detectSearchQueryKind(trimmedQuery)]} <b>"{trimmedQuery}"</b> · search
              is saved masked in the audit log
            </p>
            <StatusChip tone="neutral">No export · no "browse all"</StatusChip>
          </div>
          <DataTable
            caption="Matching customers and workers"
            columns={RESULT_COLUMNS}
            rows={results}
            rowKey={(user) => user.id}
            empty="No customer or worker matches. Check the number or spelling."
          />
        </>
      )}

      <AlertBanner tone="neutral" icon={Lightbulb}>
        Phone and email search are <b>exact match only</b> (no "starts with"). Name search needs 3+ letters.
        Staff accounts are managed in <b>Staff &amp; roles</b>, not here.
      </AlertBanner>
    </>
  );
}

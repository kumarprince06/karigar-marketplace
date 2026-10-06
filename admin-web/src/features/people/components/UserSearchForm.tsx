import { CaseSensitive, EyeOff, IdCard, Mail, Search, Smartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Card, Input, Pill, SegmentedControl } from '@/components/ui';
import type { UserTypeFilter } from '../types';

const TYPE_FILTER_OPTIONS: { value: UserTypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'WORKER', label: 'Workers' },
];

interface UserSearchFormProps {
  initialQuery: string;
  initialTypeFilter: UserTypeFilter;
  onSearch: (query: string, typeFilter: UserTypeFilter) => void;
}

/** A-02a hero: one search box, type filter, and the rules for what counts as a match. */
export function UserSearchForm({ initialQuery, initialTypeFilter, onSearch }: UserSearchFormProps) {
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(query, typeFilter);
  };

  return (
    <Card variant="brand" padding="none" className="gap-3.5 p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 font-semibold">
          <Search aria-hidden className="inline size-4 align-text-bottom" /> Find a customer or worker
        </h2>
        <Pill icon={EyeOff}>Results are masked</Pill>
      </div>
      <form
        role="search"
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center"
      >
        <Input
          type="search"
          aria-label="Phone, email, id or name"
          placeholder="Phone, email, id or name…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-12 text-base md:min-w-[240px] md:flex-1"
        />
        <SegmentedControl
          label="Account type"
          options={TYPE_FILTER_OPTIONS}
          value={typeFilter}
          onChange={setTypeFilter}
          className="w-full bg-white/15 md:w-[300px] [&>[aria-checked=false]]:text-white"
        />
        <Button type="submit" variant="accent" className="min-h-12">
          Search
        </Button>
      </form>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] opacity-90">
        <li>
          <Smartphone aria-hidden className="inline size-4 align-text-bottom" /> Exact phone{' '}
          <span className="font-mono">+919876543210</span>
        </li>
        <li>
          <Mail aria-hidden className="inline size-4 align-text-bottom" /> Exact email
        </li>
        <li>
          <IdCard aria-hidden className="inline size-4 align-text-bottom" /> Full user / customer / worker id
        </li>
        <li>
          <CaseSensitive aria-hidden className="inline size-4 align-text-bottom" /> Name prefix, at least 3
          letters
        </li>
        <li>· max 20 results</li>
      </ul>
    </Card>
  );
}

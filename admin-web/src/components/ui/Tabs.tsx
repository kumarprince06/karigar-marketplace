import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { mergeClassNames } from '@/lib/merge-class-names';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: LucideIcon;
  count?: number;
  /** When set the tab is a route link; otherwise it is local state. */
  to?: string;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value?: T;
  onChange?: (id: T) => void;
  label: string;
  className?: string;
}

const getTabClassName = (active: boolean) =>
  mergeClassNames(
    '-mb-px inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 font-semibold',
    active ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg',
  );

function TabLabel({ item }: { item: TabItem }) {
  return (
    <>
      {item.icon && <item.icon aria-hidden className="size-4" />}
      {item.label}
      {item.count !== undefined && <span className="tabular-nums">· {item.count}</span>}
    </>
  );
}

export function Tabs<T extends string>({ items, value, onChange, label, className }: TabsProps<T>) {
  return (
    <nav
      aria-label={label}
      className={mergeClassNames('border-border flex gap-1 overflow-x-auto border-b', className)}
    >
      {items.map((item) =>
        item.to ? (
          <NavLink key={item.id} to={item.to} end className={({ isActive }) => getTabClassName(isActive)}>
            <TabLabel item={item} />
          </NavLink>
        ) : (
          <button
            key={item.id}
            type="button"
            aria-current={item.id === value ? 'page' : undefined}
            onClick={() => onChange?.(item.id)}
            className={getTabClassName(item.id === value)}
          >
            <TabLabel item={item} />
          </button>
        ),
      )}
    </nav>
  );
}

import type { ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  caption?: string;
  /** Compact rows for tables nested inside cards. */
  dense?: boolean;
  empty?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  dense,
  empty,
  rowClassName,
  className,
}: DataTableProps<T>) {
  return (
    // The scroll box is focusable so keyboard users can scroll wide tables sideways (WCAG scrollable-region-focusable).
    <div
      role="region"
      aria-label={caption ?? 'Table'}
      tabIndex={0}
      className={mergeClassNames(
        'border-border bg-surface focus-visible:shadow-focus overflow-x-auto rounded-lg border',
        className,
      )}
    >
      <table className={mergeClassNames('w-full border-collapse', dense ? 'text-[13px]' : 'text-sm')}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={mergeClassNames(
                  'border-border bg-muted text-fg-muted border-b font-semibold whitespace-nowrap',
                  dense ? 'px-3 py-2 text-[11px]' : 'px-3 py-2.5 text-xs',
                  alignClass[c.align ?? 'left'],
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-fg-muted px-3 py-8 text-center">
                {empty ?? 'Nothing here.'}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={mergeClassNames('border-border border-b last:border-b-0', rowClassName?.(row))}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={mergeClassNames(
                      'align-middle',
                      dense ? 'px-3 py-1.5' : 'px-3 py-2.5',
                      alignClass[c.align ?? 'left'],
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

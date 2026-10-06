/**
 * Small presentational atoms used across every admin screen.
 * Grouped in one file because each is a few lines and they always travel together.
 */
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, Copy, Sparkles, Star, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';
import { formatShortId } from '@/lib/formatters';

/* ---------- Avatar ---------- */
const avatarVariants = cva('grid shrink-0 place-items-center rounded-full font-bold', {
  variants: {
    size: { sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-[22px]' },
    tone: {
      brand: 'bg-primary-subtle text-primary',
      warm: 'bg-warm text-ink',
      glass: 'bg-white/20 text-white',
    },
  },
  defaultVariants: { size: 'md', tone: 'brand' },
});

export function Avatar({
  initials,
  className,
  ...v
}: { initials: string; className?: string } & VariantProps<typeof avatarVariants>) {
  return (
    <span aria-hidden className={mergeClassNames(avatarVariants(v), className)}>
      {initials}
    </span>
  );
}

/* ---------- Icon tiles and illustration discs (lucide icons on a gradient) ---------- */
const tileVariants = cva('grid shrink-0 place-items-center', {
  variants: {
    tone: {
      warm: 'bg-warm text-ink shadow-warm',
      brand: 'bg-teal text-white',
      danger: 'bg-danger text-white',
      glass: 'bg-white/15 text-white ring-1 ring-white/25 ring-inset',
    },
    size: {
      sm: 'size-10 rounded-md [&>svg]:size-5',
      md: 'size-12 rounded-md [&>svg]:size-6',
      illusSm: 'size-[88px] rounded-full [&>svg]:size-10',
      illus: 'size-[132px] rounded-full [&>svg]:size-14',
    },
  },
  defaultVariants: { tone: 'warm', size: 'md' },
});

export function IconTile({
  icon: Icon,
  className,
  ...v
}: { icon: LucideIcon; className?: string } & VariantProps<typeof tileVariants>) {
  return (
    <span aria-hidden className={mergeClassNames(tileVariants(v), className)}>
      <Icon strokeWidth={1.75} />
    </span>
  );
}

/* ---------- Ids, permissions, masked values ---------- */

/** Short UUID with a copy-to-clipboard button. */
export function CopyId({ id, className }: { id: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${id}`}
      onClick={() => {
        void navigator.clipboard?.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={mergeClassNames(
        'text-fg-muted hover:text-primary inline-flex cursor-pointer items-center gap-1 font-mono text-xs whitespace-nowrap',
        className,
      )}
    >
      {formatShortId(id)}
      {copied ? (
        <Check aria-hidden className="text-success size-3" />
      ) : (
        <Copy aria-hidden className="size-3" />
      )}
      <span className="sr-only">{copied ? 'Copied' : 'Copy id'}</span>
    </button>
  );
}

/** The permission an action needs, shown next to the action (LLD-020). */
export function PermTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={mergeClassNames(
        'bg-muted text-fg-muted rounded px-1.5 py-px font-mono text-[11px] whitespace-nowrap',
        className,
      )}
    >
      {children}
    </code>
  );
}

/** PII shown masked until revealed (security/03). */
export function Masked({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={mergeClassNames('text-fg-muted font-mono text-[13px]', className)}>{children}</span>
  );
}

/* ---------- Typography helpers ---------- */

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h4 className={mergeClassNames('text-fg-muted text-xs font-bold tracking-[.06em] uppercase', className)}>
      {children}
    </h4>
  );
}

export function Money({
  children,
  size = 'md',
  className,
}: {
  children: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      className={mergeClassNames(
        'font-semibold whitespace-nowrap tabular-nums',
        size === 'lg' && 'text-[28px] leading-[34px]',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Pill({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white">
      {Icon && <Icon aria-hidden className="size-4" />}
      {children}
    </span>
  );
}

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex gap-px" role="img" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, starIndex) => (
        <Star
          key={starIndex}
          aria-hidden
          className={mergeClassNames(
            'size-4',
            starIndex < value ? 'fill-accent text-accent' : 'fill-border text-border',
          )}
        />
      ))}
    </span>
  );
}

/* ---------- KPI tile ---------- */
export function KpiTile({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={mergeClassNames('border-border bg-surface rounded-lg border p-3.5', className)}>
      <small className="text-fg-muted">{label}</small>
      <b className="text-kpi block tabular-nums">{value}</b>
      {hint && <small className="text-fg-muted">{hint}</small>}
    </div>
  );
}

/* ---------- Progress steps ---------- */
export function Steps({
  total,
  current,
  label = 'Progress',
}: {
  total: number;
  current: number;
  label?: string;
}) {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={mergeClassNames('h-1 flex-1 rounded-sm', i < current ? 'bg-warm' : 'bg-border')}
        />
      ))}
    </div>
  );
}

/* ---------- Timeline ---------- */
export interface TimelineItem {
  title: ReactNode;
  meta?: ReactNode;
  state: 'done' | 'now' | 'todo';
}

export function Timeline({ items }: { items: readonly TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item, i) => (
        <li key={i} className="flex min-h-12 gap-3">
          <span aria-hidden className="flex w-6 flex-col items-center">
            <i
              className={mergeClassNames(
                'mt-[3px] size-3.5 shrink-0 rounded-full border-2',
                item.state === 'done' && 'border-success bg-success',
                item.state === 'now' && 'border-accent bg-accent ring-accent-subtle ring-4',
                item.state === 'todo' && 'border-border-strong bg-surface',
              )}
            />
            {i < items.length - 1 && <b className="bg-border w-0.5 flex-1" />}
          </span>
          <div className="flex-1 pb-3">
            {item.title}
            {item.meta && <small className="text-fg-muted block text-[13px]">{item.meta}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon = Sparkles,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <IconTile icon={icon} tone="brand" size="illusSm" />
      <h3 className="text-h4 font-semibold">{title}</h3>
      {children && <p className="text-fg-muted max-w-md">{children}</p>}
    </div>
  );
}

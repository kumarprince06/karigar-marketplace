import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

const cardVariants = cva('flex flex-col gap-2 rounded-lg', {
  variants: {
    variant: {
      default: 'border border-border bg-surface shadow-e1',
      flat: 'border border-border bg-surface',
      brand: 'bg-brand-card text-white shadow-e2',
      warm: 'bg-warm text-ink shadow-e2',
      subtle: 'bg-canvas',
    },
    padding: { none: 'p-0', sm: 'p-3', md: 'p-4', lg: 'p-5' },
    /** Coloured top edge used on queue and status cards. */
    stripe: {
      none: '',
      error: 'border-t-4 border-t-error',
      accent: 'border-t-4 border-t-accent',
      success: 'border-t-4 border-t-success',
      primary: 'border-t-4 border-t-primary',
    },
  },
  defaultVariants: { variant: 'default', padding: 'md', stripe: 'none' },
});

export function Card({
  className,
  variant,
  padding,
  stripe,
  ...props
}: ComponentProps<'section'> & VariantProps<typeof cardVariants>) {
  return (
    <section className={mergeClassNames(cardVariants({ variant, padding, stripe }), className)} {...props} />
  );
}

/** Title row for a card: heading on the left, meta or actions on the right. */
export function CardHeader({
  title,
  aside,
  className,
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={mergeClassNames('flex items-center justify-between gap-3', className)}>
      <h3 className="text-h4 font-semibold">{title}</h3>
      {aside}
    </header>
  );
}

import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

/** One label = one enum value (design system rule). Tone carries meaning, never decoration. */
const statusChipVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[13px] leading-[18px] font-semibold',
  {
    variants: {
      tone: {
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        error: 'bg-error-subtle text-error',
        info: 'bg-info-subtle text-info',
        neutral: 'bg-neutral-subtle text-neutral',
        brand: 'bg-primary-subtle text-primary',
        accent: 'bg-accent-subtle text-accent-fg',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type Tone = NonNullable<VariantProps<typeof statusChipVariants>['tone']>;

export function StatusChip({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof statusChipVariants>) {
  return <span className={mergeClassNames(statusChipVariants({ tone }), className)} {...props} />;
}

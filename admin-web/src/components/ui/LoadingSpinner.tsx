import { cva, type VariantProps } from 'class-variance-authority';
import { mergeClassNames } from '@/lib/merge-class-names';

const loadingSpinnerVariants = cva(
  'inline-block shrink-0 rounded-full border-current border-r-transparent motion-safe:animate-spin',
  {
    variants: {
      size: { sm: 'size-4 border-2', md: 'size-6 border-[3px]', lg: 'size-10 border-4' },
    },
    defaultVariants: { size: 'md' },
  },
);

interface LoadingSpinnerProps extends VariantProps<typeof loadingSpinnerVariants> {
  /** Read by screen readers; the spinner itself is decorative. */
  label?: string;
  className?: string;
}

/** Spinning ring that inherits the text colour. Holds still when the user prefers reduced motion. */
export function LoadingSpinner({ size, label = 'Loading', className }: LoadingSpinnerProps) {
  return (
    <span role="status" className="inline-flex">
      <span aria-hidden className={mergeClassNames(loadingSpinnerVariants({ size }), className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

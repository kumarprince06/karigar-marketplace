import { ArrowRight } from 'lucide-react';
import { Link, type LinkProps } from 'react-router';
import { mergeClassNames } from '@/lib/merge-class-names';

/** Small text link ending in an arrow ("Open →", "Audit log →"), the mockups' `.badge`. */
export function ArrowLink({ className, children, ...props }: LinkProps) {
  return (
    <Link
      className={mergeClassNames(
        'text-primary inline-flex items-center gap-1 text-[13px] font-semibold whitespace-nowrap hover:underline',
        className,
      )}
      {...props}
    >
      {children}
      <ArrowRight aria-hidden className="size-3.5" />
    </Link>
  );
}

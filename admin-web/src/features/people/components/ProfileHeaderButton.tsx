import type { ComponentProps } from 'react';
import { Button } from '@/components/ui';
import { mergeClassNames } from '@/lib/merge-class-names';

/** Translucent secondary button that sits on the brand profile header. */
export function ProfileHeaderButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className={mergeClassNames('bg-white/15 text-white hover:bg-white/25', className)}
      {...props}
    />
  );
}

import type { ComponentProps } from 'react';
import { Link, type LinkProps } from 'react-router';
import { mergeClassNames } from '@/lib/merge-class-names';
import { buttonVariants, type ButtonVariantProps } from './button-variants';

export function Button({
  className,
  variant,
  size,
  block,
  type = 'button',
  ...props
}: ComponentProps<'button'> & ButtonVariantProps) {
  return (
    <button
      type={type}
      className={mergeClassNames(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

/** A router link that looks like a button. Use for navigation, never for actions. */
export function ButtonLink({ className, variant, size, block, ...props }: LinkProps & ButtonVariantProps) {
  return <Link className={mergeClassNames(buttonVariants({ variant, size, block }), className)} {...props} />;
}

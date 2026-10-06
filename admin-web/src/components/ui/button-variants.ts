import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:border-0 disabled:bg-muted disabled:bg-none disabled:text-fg-subtle disabled:shadow-none',
  {
    variants: {
      variant: {
        primary: 'bg-teal text-white shadow-primary hover:brightness-95',
        accent: 'bg-warm text-ink shadow-warm hover:brightness-95',
        secondary: 'border-[1.5px] border-primary bg-surface text-primary hover:bg-primary-subtle',
        ghost: 'bg-transparent text-primary hover:bg-primary-subtle',
        danger: 'bg-danger text-white hover:brightness-95',
        dangerOutline: 'border-[1.5px] border-error bg-surface text-error hover:bg-error-subtle',
      },
      size: {
        sm: 'min-h-8 px-2.5 text-[13px]',
        md: 'min-h-10 px-3.5 text-sm',
        lg: 'min-h-12 px-[18px] text-base',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

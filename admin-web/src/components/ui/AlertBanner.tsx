import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, MessageSquare, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

const alertBannerVariants = cva('flex gap-2.5 rounded-md px-3.5 py-3 text-sm', {
  variants: {
    tone: {
      info: 'bg-info-subtle text-info-fg',
      warning: 'bg-warning-subtle text-warning-fg',
      error: 'bg-error-subtle text-error-fg',
      success: 'bg-success-subtle text-success-fg',
      neutral: 'bg-muted text-fg',
    },
  },
  defaultVariants: { tone: 'info' },
});

const DEFAULT_ICONS: Record<'info' | 'warning' | 'error' | 'success' | 'neutral', LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  success: CircleCheck,
  neutral: MessageSquare,
};

interface AlertBannerProps extends VariantProps<typeof alertBannerVariants> {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

/** Inline message. Errors and warnings are announced to screen readers. */
export function AlertBanner({ tone, icon, children, className }: AlertBannerProps) {
  const resolvedTone = tone ?? 'info';
  const Icon = icon ?? DEFAULT_ICONS[resolvedTone];
  return (
    <div
      role={resolvedTone === 'error' || resolvedTone === 'warning' ? 'alert' : 'status'}
      className={mergeClassNames(alertBannerVariants({ tone: resolvedTone }), className)}
    >
      <Icon aria-hidden className="mt-px size-[18px] shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

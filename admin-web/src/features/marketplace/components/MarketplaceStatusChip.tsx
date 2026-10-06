import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusChip, type Tone } from '@/components/ui';
import { STATUS_APPEARANCE, type StatusKind, type StatusValue } from '../status-display';

interface MarketplaceStatusChipProps<Kind extends StatusKind> {
  kind: Kind;
  status: StatusValue<Kind>;
  /** Shown before the enum, e.g. an amount ("₹99 SUCCEEDED"). */
  prefix?: ReactNode;
  /** Shown after the enum, e.g. "round 3" or "ETA 12 min". */
  detail?: ReactNode;
}

/** Chip for any marketplace enum. Tone and icon come from STATUS_APPEARANCE; the label is the enum value. */
export function MarketplaceStatusChip<Kind extends StatusKind>({
  kind,
  status,
  prefix,
  detail,
}: MarketplaceStatusChipProps<Kind>) {
  const appearance = (STATUS_APPEARANCE[kind] as Record<string, { tone: Tone; icon?: LucideIcon }>)[status];
  const StatusIcon = appearance?.icon;
  return (
    <StatusChip tone={appearance?.tone}>
      {StatusIcon && <StatusIcon aria-hidden className="size-3.5" />}
      {prefix && <>{prefix} </>}
      {status}
      {detail && <> · {detail}</>}
    </StatusChip>
  );
}

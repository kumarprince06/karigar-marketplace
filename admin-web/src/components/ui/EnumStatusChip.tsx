import type { ReactNode } from 'react';
import { StatusChip, type Tone } from './StatusChip';

interface EnumStatusChipProps<Status extends string> {
  status: Status;
  /** One tone per enum value, defined once per enum in the owning feature. */
  tones: Record<Status, Tone>;
  /** Shown before the status, e.g. the refund amount in "₹250 PROCESSING". */
  prefix?: ReactNode;
}

/** A status chip whose label is the enum value (one label = one enum) and whose tone comes from a tone map. */
export function EnumStatusChip<Status extends string>({
  status,
  tones,
  prefix,
}: EnumStatusChipProps<Status>) {
  return (
    <StatusChip tone={tones[status]}>
      {prefix}
      {status}
    </StatusChip>
  );
}

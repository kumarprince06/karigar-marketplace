import { Link } from 'react-router';
import { StatusChip } from '@/components/ui';
import { paths } from '@/config/route-paths';
import type { BookingSummary } from '../types';

/** The "Signals" column: lateness, dispute hold (links to the dispute), or plain context text. */
export function BookingSignalCell({ booking }: { booking: BookingSummary }) {
  const { signal } = booking;
  if (!signal) return <span className="text-fg-muted">—</span>;
  if (!signal.tone) return <span className="text-fg-muted">{signal.label}</span>;
  const SignalIcon = signal.icon;
  const chip = (
    <StatusChip tone={signal.tone}>
      {SignalIcon && <SignalIcon aria-hidden className="size-3.5" />}
      {signal.label}
    </StatusChip>
  );
  return signal.disputeId ? (
    <Link to={paths.dispute(signal.disputeId)} className="hover:underline">
      {chip}
    </Link>
  ) : (
    chip
  );
}

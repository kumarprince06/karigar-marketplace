import { Button, Card, CopyId, IconTile } from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { TRADE_ICONS } from '../status-display';
import type { BookingDetail } from '../types';
import { MarketplaceStatusChip } from './MarketplaceStatusChip';

interface BookingHeroCardProps {
  detail: BookingDetail;
  onCancelClick: () => void;
}

/** Booking header: trade, id, the three separate state machines and the admin cancel action. */
export function BookingHeroCard({ detail, onCancelClick }: BookingHeroCardProps) {
  const { summary } = detail;
  const statusLanes = [
    { label: 'BOOKING', chip: <MarketplaceStatusChip kind="booking" status={summary.bookingStatus} /> },
    { label: 'JOB', chip: <MarketplaceStatusChip kind="job" status={summary.jobStatus} /> },
    {
      label: `VISIT #${detail.currentVisitNumber}`,
      chip: <MarketplaceStatusChip kind="visit" status={summary.visitStatus} detail={summary.visitDetail} />,
    },
  ];
  return (
    <Card
      variant="brand"
      padding="none"
      className="flex-row flex-wrap items-center gap-4 px-4 py-4 md:gap-5 md:px-5"
    >
      <IconTile icon={TRADE_ICONS[summary.trade]} />
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h3 font-semibold">{detail.heroTitle}</h2>
          <CopyId id={summary.id} className="text-white hover:text-white/80" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          {statusLanes.map((lane) => (
            <span key={lane.label} className="inline-flex items-center gap-1.5">
              <small className="text-xs opacity-80">{lane.label}</small>
              {lane.chip}
            </span>
          ))}
          <span className="text-[13px] opacity-90">
            {summary.type} · pays {detail.payCadence} · request{' '}
            <CopyId id={detail.requestId} className="text-white hover:text-white/80" /> ·{' '}
            {detail.offeredCount} offered · {detail.interestedCount} interested
          </span>
        </div>
      </div>
      {summary.bookingStatus === 'CONFIRMED' && (
        <RequirePermission permission="booking.manage">
          <Button variant="danger" className="w-full sm:w-auto" onClick={onCancelClick}>
            Cancel booking…
          </Button>
        </RequirePermission>
      )}
    </Card>
  );
}

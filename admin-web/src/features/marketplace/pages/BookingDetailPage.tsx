import { Info, Star } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { AlertBanner, Card, Masked, Money, SectionLabel } from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { formatMoney } from '@/lib/formatters';
import { findBookingDetail } from '../mock-data';
import { BillBreakdownCard } from '../components/BillBreakdownCard';
import { BookingHeroCard } from '../components/BookingHeroCard';
import { BookingPaymentsCard } from '../components/BookingPaymentsCard';
import { BookingTimelineCard } from '../components/BookingTimelineCard';
import { BookingVisitsTable } from '../components/BookingVisitsTable';
import { CancelBookingDialog } from '../components/CancelBookingDialog';
import { ExtraWorkAndMaterialsCard } from '../components/ExtraWorkAndMaterialsCard';

const partyLinkClassName = 'font-bold hover:text-primary hover:underline';

/** A-03c: booking / job detail with visits, quotes, bill, payments and timeline. A-03d cancel via ?dialog=cancel. */
export function BookingDetailPage() {
  const { id } = useParams();
  const detail = findBookingDetail(id);
  const cancelDialog = useUrlDialog('cancel');
  const { customer, worker, agreedRate } = detail;

  return (
    <div className="flex flex-col gap-3">
      <BookingHeroCard detail={detail} onCancelClick={() => cancelDialog.openDialog()} />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card className="min-w-0">
              <SectionLabel>Customer</SectionLabel>
              <Link to={paths.customer(customer.id)} className={partyLinkClassName}>
                {customer.name}
              </Link>
              <Masked>
                {customer.phoneMasked} · {customer.area}
              </Masked>
            </Card>
            <Card className="min-w-0">
              <SectionLabel>Worker</SectionLabel>
              <Link to={paths.worker(worker.id)} className={partyLinkClassName}>
                {worker.name}{' '}
                <Star aria-hidden className="fill-accent text-accent inline size-4 align-[-2px]" />
                <span className="sr-only">rated</span> {worker.rating}
              </Link>
              <Masked>
                {worker.phoneMasked} · {worker.verification}
              </Masked>
            </Card>
            <Card className="min-w-0">
              <SectionLabel>Agreed rate</SectionLabel>
              <b>
                <Money>{formatMoney(agreedRate.amount)}</Money> / {agreedRate.unit}
              </b>
              <span className="text-fg-muted text-[13px]">
                + helper {formatMoney(agreedRate.helperAmount)} / {agreedRate.helperUnit} · set by
                worker&apos;s accept
              </span>
            </Card>
          </div>

          <BookingVisitsTable visits={detail.visits} />

          <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
            <ExtraWorkAndMaterialsCard quotes={detail.quotes} materialBills={detail.materialBills} />
            <BillBreakdownCard lines={detail.bill} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <BookingPaymentsCard payments={detail.payments} />
          <BookingTimelineCard events={detail.timeline} />
          <AlertBanner tone="neutral" icon={Info}>
            No messages tab — chat is not in MVP. Start code value is never shown to staff.
          </AlertBanner>
        </div>
      </div>

      <RequirePermission permission="booking.manage">
        <CancelBookingDialog detail={detail} open={cancelDialog.isOpen} onClose={cancelDialog.closeDialog} />
      </RequirePermission>
    </div>
  );
}

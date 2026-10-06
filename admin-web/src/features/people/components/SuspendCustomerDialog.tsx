import { CalendarDays } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import {
  AlertBanner,
  ArrowLink,
  Button,
  CopyId,
  Field,
  ModalDialog,
  PermTag,
  Select,
  Textarea,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { formatDateTime } from '@/lib/formatters';
import { CUSTOMER_SUSPENSION_REASONS } from '../mock-data';
import type { CustomerDetail } from '../types';

interface SuspendCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  customer: CustomerDetail;
}

/** A-02d (left): suspend logs the customer out everywhere; confirmed bookings are listed, not cancelled. */
export function SuspendCustomerDialog({ open, onClose, customer }: SuspendCustomerDialogProps) {
  const formId = useId();
  const [reasonCode, setReasonCode] = useState(CUSTOMER_SUSPENSION_REASONS[0]?.code ?? '');
  const [note, setNote] = useState('3 chargeback attempts on advances this week.');
  const confirmedBookings = customer.bookings.filter((booking) => booking.bookingStatus === 'CONFIRMED');

  const handleSuspendSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Suspend customer"
      aside={<PermTag>account.suspend</PermTag>}
      description={
        <>
          {customer.name} <CopyId id={customer.id} /> will be logged out on all devices and can't log in or
          place requests.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="danger">
            Suspend customer
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSuspendSubmit} className="flex flex-col gap-3">
        <Field label="Reason">
          {({ id }) => (
            <Select id={id} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
              {CUSTOMER_SUSPENSION_REASONS.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Note" hint="(max 500)">
          {({ id }) => (
            <Textarea
              id={id}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
        {confirmedBookings.length > 0 && (
          <AlertBanner tone="warning" icon={CalendarDays}>
            <b>
              {confirmedBookings.length} confirmed booking{confirmedBookings.length === 1 ? '' : 's'} stay
              {confirmedBookings.length === 1 ? 's' : ''} active
            </b>{' '}
            — suspension does not cancel {confirmedBookings.length === 1 ? 'it' : 'them'}. Cancel separately
            if needed (needs <PermTag>booking.manage</PermTag>):
            <ul className="mt-1 flex flex-col gap-1">
              {confirmedBookings.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-1.5">
                  <CopyId id={booking.id} /> ·{' '}
                  <booking.tradeIcon aria-hidden className="inline size-4 align-text-bottom" />{' '}
                  {booking.problem} · {formatDateTime(booking.firstVisitAt)}
                  <RequirePermission permission="booking.manage">
                    · <ArrowLink to={paths.booking(booking.id)}>Cancel booking…</ArrowLink>
                  </RequirePermission>
                </li>
              ))}
            </ul>
          </AlertBanner>
        )}
        <p className="text-fg-muted text-[13px] leading-[18px]">
          Open requests expire on their own. Reinstate later from this page (same reason + note). DEACTIVATED
          accounts can't be reinstated.
        </p>
      </form>
    </ModalDialog>
  );
}

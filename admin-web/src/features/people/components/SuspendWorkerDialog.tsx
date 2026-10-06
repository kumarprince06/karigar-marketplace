import { CalendarDays } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import {
  AlertBanner,
  Button,
  CopyId,
  Field,
  ModalDialog,
  PermTag,
  Select,
  Textarea,
  ToggleSwitch,
} from '@/components/ui';
import { formatDateTime } from '@/lib/formatters';
import { WORKER_SUSPENSION_REASONS } from '../mock-data';
import type { WorkerDetail } from '../types';

interface SuspendWorkerDialogProps {
  open: boolean;
  onClose: () => void;
  worker: WorkerDetail;
}

/** A-02f: suspend stops offers at once; confirmed bookings are cancelled automatically (WORKER_SUSPENDED). */
export function SuspendWorkerDialog({ open, onClose, worker }: SuspendWorkerDialogProps) {
  const formId = useId();
  const [reasonCode, setReasonCode] = useState(WORKER_SUSPENSION_REASONS[0]?.code ?? '');
  const [note, setNote] = useState('Customer complaint, call ref 4411');
  const [blockLogin, setBlockLogin] = useState(false);
  const bookingCount = worker.confirmedBookings.length;

  const handleSuspendSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Suspend worker"
      aside={<PermTag>account.suspend</PermTag>}
      description={
        <>
          {worker.name} <CopyId id={worker.id} /> stops getting offers at once; accepted offers are withdrawn.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="danger">
            Suspend worker
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSuspendSubmit} className="flex flex-col gap-3">
        <Field label="Reason">
          {({ id }) => (
            <Select id={id} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
              {WORKER_SUSPENSION_REASONS.map((reason) => (
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
        <div className="border-border bg-canvas flex items-start gap-3 rounded-lg border p-3.5">
          <ToggleSwitch checked={blockLogin} onChange={setBlockLogin} label="Also block login" hideLabel />
          <div>
            <b>Also block login</b> <span className="text-fg-subtle">(blockLogin)</span>
            <p className="text-fg-muted text-[13px]">
              For fraud or safety. Off: the worker can still log in to see earnings and dues and check out a
              visit in progress. On: account suspended and all sessions revoked.
            </p>
          </div>
        </div>
        {bookingCount > 0 && (
          <AlertBanner tone="error" icon={CalendarDays}>
            <b>
              {bookingCount} confirmed booking{bookingCount === 1 ? '' : 's'} will be cancelled automatically
            </b>{' '}
            (reason WORKER_SUSPENDED) and the requests go back to matching; customers keep their advance.
            <ul className="mt-1 flex flex-col gap-0.5">
              {worker.confirmedBookings.map((booking) => (
                <li key={booking.id}>
                  <CopyId id={booking.id} /> {formatDateTime(booking.startsAt)}
                  {booking.visitStatus && ` — visit ${booking.visitStatus}, can be checked out first`}
                </li>
              ))}
            </ul>
          </AlertBanner>
        )}
        <p className="text-fg-muted text-[13px] leading-[18px]">
          Reinstate later restores ACTIVE (and login, if blocked). Readiness is not re-checked.
        </p>
      </form>
    </ModalDialog>
  );
}

import { ArrowLeftRight, Undo2 } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  Card,
  CopyId,
  Field,
  ModalDialog,
  Money,
  PermTag,
  SectionLabel,
  Select,
  StatusChip,
  Textarea,
} from '@/components/ui';
import { formatMoney } from '@/lib/formatters';
import { CANCEL_REASONS } from '../mock-data';
import type { BookingDetail } from '../types';
import { TradeLabel } from './TradeLabel';

interface CancelBookingDialogProps {
  detail: BookingDetail;
  open: boolean;
  onClose: () => void;
}

const NOTE_MAX_LENGTH = 500;
const previewRowClassName = 'flex items-center justify-between gap-3 text-[13px]';

/** A-03d: admin cancel. POST /admin/bookings/{id}/cancel {reasonCode, note}; money rules come from the server. */
export function CancelBookingDialog({ detail, open, onClose }: CancelBookingDialogProps) {
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const { summary, cancellationPreview } = detail;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Cancel booking"
      aside={<PermTag>booking.manage</PermTag>}
      description={
        <p className="text-[13px]">
          Booking <CopyId id={summary.id} /> · <TradeLabel trade={summary.trade} title={summary.title} /> ·{' '}
          {summary.customerName} <ArrowLeftRight aria-hidden className="inline size-3.5 align-[-2px]" />
          <span className="sr-only">and</span> {summary.workerName} · {detail.nextVisitDescription}.
        </p>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep booking
          </Button>
          <Button variant="danger" disabled={!reasonCode} onClick={onClose}>
            Cancel booking
          </Button>
        </>
      }
    >
      <Field label="Reason">
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
          >
            <option value="" disabled>
              Select reason (from the server&apos;s list)
            </option>
            {CANCEL_REASONS.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Note" hint={<em>(max {NOTE_MAX_LENGTH})</em>}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="Customer called support; cannot use the app (phone broken)."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </Field>
      <Card variant="subtle" padding="md" className="border-border gap-1.5 border">
        <SectionLabel>What happens (server preview)</SectionLabel>
        <dl className="flex flex-col gap-1.5">
          <div className={previewRowClassName}>
            <dt>Cancelled by</dt>
            <dd className="font-bold">{cancellationPreview.cancelledBy}</dd>
          </div>
          <div className={previewRowClassName}>
            <dt>Customer pays</dt>
            <dd className="font-bold">
              <Money>{formatMoney(cancellationPreview.customerPays)}</Money>
            </dd>
          </div>
          <div className={previewRowClassName}>
            <dt>Advance {formatMoney(cancellationPreview.advance)}</dt>
            <dd>
              <StatusChip tone="info">
                <Undo2 aria-hidden className="size-3.5" /> {cancellationPreview.advanceOutcome}
              </StatusChip>
            </dd>
          </div>
          <div className={previewRowClassName}>
            <dt>Worker gets</dt>
            <dd className="font-bold">
              <Money>{formatMoney(cancellationPreview.workerGets)}</Money>
            </dd>
          </div>
          <div className={previewRowClassName}>
            <dt>Strike</dt>
            <dd>{cancellationPreview.strike}</dd>
          </div>
          <div className={previewRowClassName}>
            <dt>Request</dt>
            <dd>{cancellationPreview.requestOutcome}</dd>
          </div>
        </dl>
      </Card>
      <p className="text-fg-muted text-[13px] leading-[18px]">
        Same money rules as customer / worker cancellations (LLD-009 §8), applied by the server with{' '}
        <code className="font-mono">cancelled_by = ADMIN</code>. Both parties get a push + inbox message.
      </p>
    </ModalDialog>
  );
}

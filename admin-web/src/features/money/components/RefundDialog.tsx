import { KeyRound, Undo2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  AlertBanner,
  Button,
  Card,
  CopyId,
  Field,
  Input,
  ModalDialog,
  PermTag,
  Textarea,
} from '@/components/ui';
import { formatMoney } from '@/lib/formatters';
import { calculateProRataRefund } from '../calculate-pro-rata-refund';
import { formatSignedMoney, parseRupeesToPaise } from '../money-text';
import { getRefundTotals } from '../payment-refunds';
import type { Payment, PaymentMethod } from '../types';

const REFUND_DESTINATION_LABELS: Record<PaymentMethod, string> = {
  UPI: 'UPI',
  CARD: 'card',
  NETBANKING: 'bank account',
  WALLET: 'wallet',
  CASH: 'cash',
};

interface RefundDialogProps {
  payment: Payment;
  onClose: () => void;
}

/** A-05b. Mounted only while open, so every opening starts with an empty form. */
export function RefundDialog({ payment, onClose }: RefundDialogProps) {
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');

  const { refundedPaise, refundablePaise } = getRefundTotals(payment);
  const hasRefundInFlight = payment.refunds.some(
    (refund) => refund.status === 'REQUESTED' || refund.status === 'PROCESSING',
  );
  const refundPaise = parseRupeesToPaise(amountText);
  const amountError =
    amountText === ''
      ? undefined
      : refundPaise === null || refundPaise === 0
        ? 'Enter an amount in rupees, e.g. 500 or 99.50.'
        : refundPaise > refundablePaise
          ? `More than the ${formatMoney(refundablePaise)} refundable (REFUND_EXCEEDS_PAYMENT).`
          : undefined;
  const validRefundPaise = refundPaise !== null && refundPaise > 0 && !amountError ? refundPaise : null;
  // ponytail: browser-side split is a static-design stand-in; the server returns the real preview (LLD-011 D9).
  const proRataLines =
    validRefundPaise === null ? [] : calculateProRataRefund(payment.splitLines, validRefundPaise);
  const workerShareRefundPaise = proRataLines.find((line) => line.id === 'worker-share')?.refundPaise ?? 0;
  const canSubmit = validRefundPaise !== null && note.trim() !== '';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onClose();
  };

  return (
    <ModalDialog
      open
      onClose={onClose}
      size="lg"
      title={
        <>
          <span className="inline-flex items-center gap-2">
            <Undo2 aria-hidden className="size-5" /> Refund payment
          </span>
        </>
      }
      aside={<PermTag>finance.refund</PermTag>}
      description={
        <>
          {payment.purpose} · {payment.method} <CopyId id={payment.id} /> · {formatMoney(payment.amountPaise)}{' '}
          paid
          {refundedPaise > 0 && (
            <>
              {' '}
              · {formatMoney(refundedPaise)} already {hasRefundInFlight ? 'refunding' : 'refunded'}
            </>
          )}{' '}
          · <b className="text-fg">{formatMoney(refundablePaise)} refundable</b>
        </>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field label="Amount" error={amountError} className="flex-1">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                leading="₹"
                inputMode="decimal"
                autoComplete="off"
                required
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                className="tabular-nums"
              />
            )}
          </Field>
          <Field label="Reason" className="flex-1">
            {({ id }) => <Input id={id} value="ADMIN (fixed)" readOnly disabled />}
          </Field>
        </div>

        <Field label="Note" hint="(required)">
          {({ id }) => (
            <Textarea
              id={id}
              required
              rows={2}
              className="min-h-16"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why this refund, and what the customer agreed to."
            />
          )}
        </Field>

        <Card variant="subtle" padding="none" className="gap-0 text-sm">
          <div className="flex min-h-9 items-center gap-2 px-3.5 py-1.5">
            <b className="flex-1">
              Pro-rata reversal of the original split
              {validRefundPaise !== null &&
                ` (${((validRefundPaise / payment.amountPaise) * 100).toFixed(2)}%)`}
            </b>
            <span className="text-fg-muted text-[13px]">from server</span>
          </div>
          {proRataLines.length === 0 ? (
            <p className="text-fg-muted px-3.5 py-1.5">Enter an amount to see how the refund is split.</p>
          ) : (
            proRataLines.map((line) => (
              <div key={line.id} className="flex min-h-9 items-center gap-2 px-3.5 py-1.5">
                <span className="flex-1">{line.label}</span>
                <span className="tabular-nums">{formatSignedMoney(-line.refundPaise)}</span>
              </div>
            ))
          )}
          <div className="border-border flex min-h-9 items-center gap-2 border-t px-3.5 py-2 font-bold">
            <span className="flex-1">Refund to customer’s {REFUND_DESTINATION_LABELS[payment.method]}</span>
            <span className="tabular-nums">
              {validRefundPaise === null ? '—' : formatMoney(validRefundPaise)}
            </span>
          </div>
        </Card>

        {payment.paidOutWorker && workerShareRefundPaise > 0 && (
          <AlertBanner tone="warning">
            {payment.paidOutWorker.name} was already paid out for this job. Their balance goes to{' '}
            <b>{formatSignedMoney(payment.paidOutWorker.balancePaise - workerShareRefundPaise)}</b> and is
            recovered from later earnings.
          </AlertBanner>
        )}

        <p className="text-fg-muted text-[13px]">
          <KeyRound aria-hidden className="mr-1 inline size-3.5" /> Idempotency key is created when you open
          this dialog, so a double click or retry refunds once. Saved in the audit log.
        </p>

        <footer className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={!canSubmit}>
            Refund {validRefundPaise === null ? '' : formatMoney(validRefundPaise)}
          </Button>
        </footer>
      </form>
    </ModalDialog>
  );
}

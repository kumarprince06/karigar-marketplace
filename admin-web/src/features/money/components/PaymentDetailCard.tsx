import { Check, Undo2 } from 'lucide-react';
import { Link } from 'react-router';
import {
  Button,
  Card,
  CopyId,
  EnumStatusChip,
  KeyValueList,
  Masked,
  PermTag,
  SectionLabel,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { formatMoney } from '@/lib/formatters';
import { DEMO_IDS } from '@/mocks/demo-ids';
import { canRefundPayment, getRefundTotals } from '../payment-refunds';
import { PAYMENT_STATUS_TONES, REFUND_STATUS_TONES } from '../status-tones';
import type { Payment } from '../types';

interface PaymentDetailCardProps {
  payment: Payment;
  onRefundClick: () => void;
}

/** Right rail of A-05a: amounts, statuses and provider reference only. */
export function PaymentDetailCard({ payment, onRefundClick }: PaymentDetailCardProps) {
  const { refundedPaise, refundablePaise } = getRefundTotals(payment);

  return (
    <Card aria-label="Selected payment">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-h4 font-semibold">
          Payment <CopyId id={payment.id} />
        </h3>
        <EnumStatusChip status={payment.status} tones={PAYMENT_STATUS_TONES} />
      </header>
      <KeyValueList
        items={[
          { label: 'Purpose · method', value: `${payment.purpose} · ${payment.method}` },
          { label: 'Amount', value: <b className="tabular-nums">{formatMoney(payment.amountPaise)}</b> },
          {
            label: 'Payer',
            value: (
              <>
                <Link
                  to={
                    payment.subject.kind === 'worker'
                      ? paths.worker(payment.subject.id)
                      : paths.customer(DEMO_IDS.customer)
                  }
                  className="hover:text-primary underline"
                >
                  {payment.payerName}
                </Link>{' '}
                · <Masked>{payment.payerMaskedHandle}</Masked>
              </>
            ),
          },
          { label: 'Provider ref', value: <span className="font-mono">{payment.providerReference}</span> },
          {
            label: 'Captured',
            value: (
              <>
                {payment.capturedLabel}
                {payment.webhookConfirmed && (
                  <>
                    {' '}
                    · webhook <Check aria-hidden className="inline size-3.5" />
                    <span className="sr-only">confirmed</span>
                  </>
                )}
              </>
            ),
          },
          {
            label: 'Refunded',
            value: (
              <span className="tabular-nums">
                {formatMoney(refundedPaise)} · {formatMoney(refundablePaise)} left
              </span>
            ),
          },
        ]}
      />

      <SectionLabel>Refunds</SectionLabel>
      {payment.refunds.length === 0 ? (
        <p className="text-fg-muted text-[13px]">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {payment.refunds.map((refund) => (
            <li key={refund.id} className="flex items-center justify-between gap-2">
              <span>
                {formatMoney(refund.amountPaise)} · {refund.initiatedBy} · {refund.createdAtLabel}
              </span>
              <EnumStatusChip status={refund.status} tones={REFUND_STATUS_TONES} />
            </li>
          ))}
        </ul>
      )}

      <RequirePermission permission="finance.refund">
        <Button block onClick={onRefundClick} disabled={!canRefundPayment(payment)}>
          <Undo2 aria-hidden className="size-4" /> Refund…
        </Button>
      </RequirePermission>
      <p className="text-fg-muted text-[13px]">
        Needs <PermTag>finance.refund</PermTag>. Cash payments can’t be refunded here.
      </p>
    </Card>
  );
}

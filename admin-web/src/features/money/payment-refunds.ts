import type { Paise } from '@/lib/formatters';
import type { Payment } from './types';

/** Refunds count against the payment unless they FAILED (LLD-011: total refunds ≤ payment). */
export function getRefundTotals(payment: Payment): { refundedPaise: Paise; refundablePaise: Paise } {
  const refundedPaise = payment.refunds
    .filter((refund) => refund.status !== 'FAILED')
    .reduce((sum, refund) => sum + refund.amountPaise, 0);
  return { refundedPaise, refundablePaise: payment.amountPaise - refundedPaise };
}

/** Only captured online payments can be refunded here; cash is settled through disputes. */
export function canRefundPayment(payment: Payment): boolean {
  return (
    payment.method !== 'CASH' &&
    payment.status === 'SUCCEEDED' &&
    getRefundTotals(payment).refundablePaise > 0
  );
}

import { CreditCard } from 'lucide-react';
import { Card, CopyId } from '@/components/ui';
import { formatMoney } from '@/lib/formatters';
import type { BookingPayment } from '../types';
import { MarketplaceStatusChip } from './MarketplaceStatusChip';

/** Payments recorded against the booking (LLD-011). */
export function BookingPaymentsCard({ payments }: { payments: readonly BookingPayment[] }) {
  return (
    <Card>
      <h3 className="text-h4 flex items-center gap-1.5 font-semibold">
        <CreditCard aria-hidden className="size-4" /> Payments
      </h3>
      <ul className="flex flex-col gap-2">
        {payments.map((payment) => (
          <li key={payment.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span>
              {payment.purpose} · {payment.method}
              {payment.note && ` · ${payment.note}`} <CopyId id={payment.id} />
            </span>
            <MarketplaceStatusChip
              kind="payment"
              status={payment.status}
              prefix={formatMoney(payment.amount)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

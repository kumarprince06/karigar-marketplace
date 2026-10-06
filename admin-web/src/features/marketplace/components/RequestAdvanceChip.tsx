import { Hourglass, Undo2 } from 'lucide-react';
import { StatusChip } from '@/components/ui';
import { formatMoney } from '@/lib/formatters';
import { formatClockTime } from '@/lib/formatters';
import type { RequestAdvance } from '../types';

/** The ₹99 advance for a request, joined from payments and refunds (LLD-011). */
export function RequestAdvanceChip({ advance }: { advance: RequestAdvance }) {
  switch (advance.state) {
    case 'DUE':
      return (
        <StatusChip tone="warning">
          <Hourglass aria-hidden className="size-3.5" /> due {formatClockTime(advance.dueAt)}
        </StatusChip>
      );
    case 'PAID':
      return <StatusChip tone="success">{formatMoney(advance.amount)} paid</StatusChip>;
    case 'NOT_PAID':
      return <StatusChip tone="neutral">not paid</StatusChip>;
    case 'REFUND_PROCESSING':
      return (
        <StatusChip tone="info">
          <Undo2 aria-hidden className="size-3.5" /> refund PROCESSING
        </StatusChip>
      );
    case 'REFUNDED':
      return (
        <StatusChip tone="success">
          <Undo2 aria-hidden className="size-3.5" /> refunded {formatMoney(advance.amount)}
        </StatusChip>
      );
  }
}

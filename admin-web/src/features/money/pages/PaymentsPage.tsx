import { Banknote, CreditCard, Landmark, Search, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import { createElement, useState } from 'react';
import { DataTable, EnumStatusChip, Input, Select, type Column } from '@/components/ui';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { RequirePermission } from '@/features/auth';
import { formatMoney, formatShortId } from '@/lib/formatters';
import { PaymentDetailCard } from '../components/PaymentDetailCard';
import { PaymentSubjectLink } from '../components/PaymentSubjectLink';
import { RefundDialog } from '../components/RefundDialog';
import { PAYMENTS } from '../mock-data';
import { PAYMENT_STATUS_TONES, REFUND_STATUS_TONES } from '../status-tones';
import type { Payment, PaymentMethod, PaymentPurpose, PaymentStatus } from '../types';

const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_TONES) as PaymentStatus[];
const PAYMENT_METHODS: readonly PaymentMethod[] = ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'CASH'];
const PAYMENT_PURPOSES: readonly PaymentPurpose[] = [
  'BOOKING_ADVANCE',
  'VISIT_CHARGE',
  'DAILY_WAGE',
  'MILESTONE',
  'FINAL',
  'ADDITIONAL',
  'WORKER_DUES',
];
const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  UPI: Smartphone,
  CARD: CreditCard,
  NETBANKING: Landmark,
  WALLET: Wallet,
  CASH: Banknote,
};
const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Today'] as const;
const ANY = 'any';

/** A-05a Payments & refunds, with the A-05b refund dialog (?dialog=refund). */
export function PaymentsPage() {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | typeof ANY>(ANY);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | typeof ANY>(ANY);
  const [purposeFilter, setPurposeFilter] = useState<PaymentPurpose | typeof ANY>(ANY);
  const [dateRange, setDateRange] = useState<string>(DATE_RANGES[0]);
  const refundDialog = useUrlDialog('refund');
  // ?payment=<id> preselects a payment, so queues can deep-link straight into its refund dialog.
  const [selectedPaymentId, setSelectedPaymentId] = useState(
    () => refundDialog.params.get('payment') ?? PAYMENTS[0]?.id,
  );

  const normalisedSearch = searchText.trim().toLowerCase().replace('…', '');
  // ponytail: date range is not applied, mock rows carry display labels; the API filters by date.
  const visiblePayments = PAYMENTS.filter(
    (payment) =>
      (statusFilter === ANY || payment.status === statusFilter) &&
      (methodFilter === ANY || payment.method === methodFilter) &&
      (purposeFilter === ANY || payment.purpose === purposeFilter) &&
      (normalisedSearch === '' ||
        payment.id.includes(normalisedSearch) ||
        payment.subject.id.includes(normalisedSearch)),
  );
  const selectedPayment = PAYMENTS.find((payment) => payment.id === selectedPaymentId) ?? PAYMENTS[0];

  const columns: Column<Payment>[] = [
    {
      id: 'payment',
      header: 'Payment',
      cell: (payment) => (
        <button
          type="button"
          aria-pressed={payment.id === selectedPayment?.id}
          onClick={() => setSelectedPaymentId(payment.id)}
          className="hover:text-primary cursor-pointer text-left"
        >
          <span className="text-fg-muted block font-mono text-xs">{formatShortId(payment.id)}</span>
          <span className="text-fg-subtle text-[13px]">{payment.createdAtLabel}</span>
        </button>
      ),
    },
    { id: 'purpose', header: 'Purpose', cell: (payment) => payment.purpose },
    {
      id: 'method',
      header: 'Method',
      cell: (payment) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {createElement(PAYMENT_METHOD_ICONS[payment.method], { 'aria-hidden': true, className: 'size-4' })}
          {payment.method}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      className: 'font-semibold tabular-nums',
      cell: (payment) => formatMoney(payment.amountPaise),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (payment) => <EnumStatusChip status={payment.status} tones={PAYMENT_STATUS_TONES} />,
    },
    {
      id: 'refunds',
      header: 'Refunds',
      cell: (payment) => {
        if (payment.method === 'CASH') return <span className="text-fg-subtle">n/a cash</span>;
        const latestRefund = payment.refunds.at(-1);
        return latestRefund ? (
          <EnumStatusChip
            status={latestRefund.status}
            tones={REFUND_STATUS_TONES}
            prefix={`${formatMoney(latestRefund.amountPaise)} `}
          />
        ) : (
          '—'
        );
      },
    },
    { id: 'for', header: 'For', cell: (payment) => <PaymentSubjectLink subject={payment.subject} /> },
  ];

  return (
    <>
      <div role="search" aria-label="Filter payments" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Input
          aria-label="Payment or booking id"
          leading={<Search className="size-4" />}
          placeholder="Payment / booking id"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          className="col-span-2 w-full sm:w-[230px]"
        />
        <Select
          aria-label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as PaymentStatus | typeof ANY)}
          className="w-full sm:w-40"
        >
          <option value={ANY}>Status: any</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </Select>
        <Select
          aria-label="Method"
          value={methodFilter}
          onChange={(event) => setMethodFilter(event.target.value as PaymentMethod | typeof ANY)}
          className="w-full sm:w-40"
        >
          <option value={ANY}>Method: any</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </Select>
        <Select
          aria-label="Purpose"
          value={purposeFilter}
          onChange={(event) => setPurposeFilter(event.target.value as PaymentPurpose | typeof ANY)}
          className="w-full sm:w-[190px]"
        >
          <option value={ANY}>Purpose: any</option>
          {PAYMENT_PURPOSES.map((purpose) => (
            <option key={purpose}>{purpose}</option>
          ))}
        </Select>
        <Select
          aria-label="Date range"
          value={dateRange}
          onChange={(event) => setDateRange(event.target.value)}
          className="w-full sm:w-[150px]"
        >
          {DATE_RANGES.map((range) => (
            <option key={range}>{range}</option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <DataTable
          caption="Payments"
          columns={columns}
          rows={visiblePayments}
          rowKey={(payment) => payment.id}
          rowClassName={(payment) => (payment.id === selectedPayment?.id ? 'bg-primary-subtle' : undefined)}
          empty="No payments match these filters."
          className="min-w-0 flex-1"
        />
        {selectedPayment && (
          <aside className="w-full xl:w-[340px] xl:shrink-0">
            <PaymentDetailCard payment={selectedPayment} onRefundClick={() => refundDialog.openDialog()} />
          </aside>
        )}
      </div>

      {refundDialog.isOpen && selectedPayment && (
        <RequirePermission permission="finance.refund">
          <RefundDialog payment={selectedPayment} onClose={refundDialog.closeDialog} />
        </RequirePermission>
      )}
    </>
  );
}

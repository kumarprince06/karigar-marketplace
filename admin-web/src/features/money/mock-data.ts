import { DEMO_IDS } from '@/mocks/demo-ids';
import type { Paise } from '@/lib/formatters';
import type { SplitLine } from './calculate-pro-rata-refund';
import type {
  DisputedCashPayment,
  ParkedProviderEvent,
  Payment,
  Payout,
  PayoutAccount,
  PayoutHold,
  StuckRefund,
  WorkerLedger,
} from './types';

/* Typed mock records for A-05. Replaced by the /admin/payments, /admin/ops/queues, /admin/payout-accounts,
 * /admin/payouts and /admin/ledger reads when the API is wired. */

/** UUIDv7-shaped id whose short form (last 6 characters) matches the mockup. */
const mockId = (tail: string) => `01928f6e-7c1a-7b3e-9d2f-${tail.padStart(12, '0')}`;

/** Mock-only: 10% platform fee and 18% GST on the fee (LLD-010 D1/D2). The server owns the real split. */
function standardSplit(amountPaise: Paise): SplitLine[] {
  const platformFeePaise = Math.round(amountPaise / 10);
  const gstOnFeePaise = Math.round((platformFeePaise * 18) / 100);
  return [
    {
      id: 'worker-share',
      label: 'Worker share',
      amountPaise: amountPaise - platformFeePaise - gstOnFeePaise,
    },
    { id: 'platform-fee', label: 'Platform fee (10%)', amountPaise: platformFeePaise },
    { id: 'gst-on-fee', label: 'GST on fee (18%)', amountPaise: gstOnFeePaise },
  ];
}

const payer = { payerName: 'Rina Das', payerMaskedHandle: 'r***@okaxis' };

export const PAYMENTS: readonly Payment[] = [
  {
    id: DEMO_IDS.payment,
    createdAtLabel: 'Today 10:05',
    purpose: 'FINAL',
    method: 'UPI',
    amountPaise: 185_000,
    status: 'SUCCEEDED',
    refunds: [
      {
        id: mockId('d1f0e3'),
        amountPaise: 25_000,
        status: 'PROCESSING',
        initiatedBy: 'ADMIN',
        createdAtLabel: 'Today 10:40',
      },
    ],
    subject: { kind: 'booking', id: DEMO_IDS.booking },
    ...payer,
    providerReference: 'pay_Nx…8KcQ',
    capturedLabel: 'Today 10:05',
    webhookConfirmed: true,
    splitLines: standardSplit(185_000),
    paidOutWorker: { name: 'Mitali Pal', balancePaise: 0 },
  },
  {
    id: mockId('51a7f3'),
    createdAtLabel: 'Today 10:20',
    purpose: 'BOOKING_ADVANCE',
    method: 'UPI',
    amountPaise: 9_900,
    status: 'SUCCEEDED',
    refunds: [],
    subject: { kind: 'request', id: mockId('3c88d5') },
    ...payer,
    providerReference: 'pay_Ob…2LtA',
    capturedLabel: 'Today 10:20',
    webhookConfirmed: true,
    splitLines: standardSplit(9_900),
  },
  {
    id: mockId('2e11d0'),
    createdAtLabel: 'Today 10:58',
    purpose: 'BOOKING_ADVANCE',
    method: 'CARD',
    amountPaise: 9_900,
    status: 'PENDING',
    refunds: [],
    subject: { kind: 'request', id: mockId('e0a4c1') },
    ...payer,
    providerReference: 'pay_Oc…7HwM',
    capturedLabel: '— awaiting webhook',
    splitLines: standardSplit(9_900),
  },
  {
    id: mockId('a4be71'),
    createdAtLabel: 'Yesterday',
    purpose: 'FINAL',
    method: 'CASH',
    amountPaise: 65_000,
    status: 'DISPUTED',
    refunds: [],
    subject: { kind: 'booking', id: mockId('77c1e3') },
    ...payer,
    providerReference: '—',
    capturedLabel: 'Worker marked cash 4 Oct 18:30',
    splitLines: standardSplit(65_000),
  },
  {
    id: mockId('c13a90'),
    createdAtLabel: '5 Oct',
    purpose: 'DAILY_WAGE',
    method: 'CASH',
    amountPaise: 120_000,
    status: 'SUCCEEDED',
    refunds: [],
    subject: { kind: 'booking', id: mockId('3f9a1c') },
    ...payer,
    providerReference: '—',
    capturedLabel: 'Worker marked cash 5 Oct 17:10',
    splitLines: standardSplit(120_000),
  },
  {
    id: mockId('f97c4e'),
    createdAtLabel: 'Today 08:30',
    purpose: 'BOOKING_ADVANCE',
    method: 'UPI',
    amountPaise: 9_900,
    status: 'SUCCEEDED',
    refunds: [
      {
        id: mockId('b2c4a1'),
        amountPaise: 9_900,
        status: 'SUCCEEDED',
        initiatedBy: 'SYSTEM',
        createdAtLabel: 'Today 09:02',
      },
    ],
    subject: { kind: 'request', id: mockId('a4730b') },
    ...payer,
    providerReference: 'pay_Oa…9PzE',
    capturedLabel: 'Today 08:30',
    webhookConfirmed: true,
    splitLines: standardSplit(9_900),
  },
  {
    id: mockId('0d5f2b'),
    createdAtLabel: '4 Oct',
    purpose: 'ADDITIONAL',
    method: 'NETBANKING',
    amountPaise: 120_000,
    status: 'CANCELLED',
    refunds: [],
    subject: { kind: 'booking', id: mockId('0f4b9e') },
    ...payer,
    providerReference: 'pay_Nq…4RsB',
    capturedLabel: '— not captured',
    splitLines: standardSplit(120_000),
  },
  {
    id: mockId('6b8e01'),
    createdAtLabel: 'Today 08:02',
    purpose: 'BOOKING_ADVANCE',
    method: 'UPI',
    amountPaise: 9_900,
    status: 'FAILED',
    refunds: [],
    subject: { kind: 'request', id: mockId('2e6c19') },
    ...payer,
    providerReference: 'pay_Oa…1KdF',
    capturedLabel: '— payment failed',
    splitLines: standardSplit(9_900),
  },
  {
    id: mockId('e4c6d3'),
    createdAtLabel: '3 Oct',
    purpose: 'WORKER_DUES',
    method: 'UPI',
    amountPaise: 42_000,
    status: 'SUCCEEDED',
    refunds: [],
    subject: { kind: 'worker', id: DEMO_IDS.worker, name: 'Rinku Paul' },
    payerName: 'Rinku Paul',
    payerMaskedHandle: 'r***@ybl',
    providerReference: 'pay_Nm…6VuC',
    capturedLabel: '3 Oct 14:02',
    webhookConfirmed: true,
    splitLines: [{ id: 'dues', label: 'Worker dues', amountPaise: 42_000 }],
  },
  {
    id: mockId('789ab4'),
    createdAtLabel: '2 Oct',
    purpose: 'VISIT_CHARGE',
    method: 'UPI',
    amountPaise: 40_000,
    status: 'SUCCEEDED',
    refunds: [
      {
        id: mockId('5c77e2'),
        amountPaise: 40_000,
        status: 'FAILED',
        initiatedBy: 'ADMIN',
        createdAtLabel: '5 Oct 11:20',
      },
    ],
    subject: { kind: 'booking', id: mockId('5a92d0') },
    ...payer,
    providerReference: 'pay_Nh…3JyD',
    capturedLabel: '2 Oct 16:45',
    webhookConfirmed: true,
    splitLines: standardSplit(40_000),
  },
];

export const STUCK_REFUNDS: readonly StuckRefund[] = [
  {
    id: mockId('5c77e2'),
    paymentId: mockId('789ab4'),
    paymentMethod: 'UPI',
    amountPaise: 40_000,
    reasonCode: 'DISPUTE_RESOLVED',
    status: 'FAILED',
    ageLabel: '26 h',
    failure: 'BAD_REQUEST_ERROR · account closed',
  },
];

export const PARKED_PROVIDER_EVENTS: readonly ParkedProviderEvent[] = [
  {
    id: mockId('7b0c19'),
    provider: 'razorpay',
    eventType: 'refund.processed',
    receivedLabel: 'yesterday 22:14',
    attempts: 5,
    processingError: 'REFUND_NOT_FOUND',
    acknowledgement: 'HANDLED_ELSEWHERE',
  },
];

export const DISPUTED_CASH_PAYMENTS: readonly DisputedCashPayment[] = [
  {
    paymentId: mockId('a4be71'),
    bookingId: mockId('77c1e3'),
    amountPaise: 65_000,
    workerMarkedLabel: '4 Oct 18:30',
    customerSays: '“I paid only ₹400”',
    disputeId: DEMO_IDS.dispute,
    disputeStatus: 'IN_REVIEW',
    ageLabel: '19 h',
  },
  {
    paymentId: mockId('9e4d27'),
    bookingId: mockId('18aa0c'),
    amountPaise: 35_000,
    workerMarkedLabel: '3 Oct 12:10',
    customerSays: '“Never paid cash”',
    disputeId: mockId('3e90b1'),
    disputeStatus: 'AWAITING_RESPONSE',
    ageLabel: '2 d',
  },
];

export const PAYOUT_ACCOUNTS: readonly PayoutAccount[] = [
  {
    id: mockId('aa1001'),
    workerId: mockId('41bb7e'),
    workerName: 'Rakesh Mondal',
    accountLastFour: '4821',
    ifsc: 'SBIN0001234',
    bankReturnedName: 'R MONDAL ENTERPRISES',
    nameMatchScore: 65,
    pennyDropSucceeded: true,
    status: 'NEEDS_REVIEW',
    addedLabel: 'Today 09:12',
  },
  {
    id: mockId('aa1002'),
    workerId: mockId('4a7e21'),
    workerName: 'Pradip Saha',
    accountLastFour: '0937',
    ifsc: 'HDFC0004567',
    bankReturnedName: 'PRADEEP SAHA',
    nameMatchScore: 50,
    pennyDropSucceeded: true,
    status: 'NEEDS_REVIEW',
    addedLabel: 'Yesterday',
  },
  {
    id: mockId('aa1003'),
    workerId: mockId('c09d12'),
    workerName: 'Tapas Ghosh',
    accountLastFour: '1186',
    ifsc: 'UBIN0532118',
    bankReturnedName: '—',
    nameMatchScore: 0,
    pennyDropSucceeded: false,
    status: 'PENDING_VERIFICATION',
    addedLabel: 'Today 10:31',
  },
];

export const PAYOUTS: readonly Payout[] = [
  {
    id: mockId('b1e0d4'),
    workerName: 'Sujit Das',
    amountPaise: 324_000,
    status: 'PAID',
    batchLabel: '5 Oct',
  },
  {
    id: mockId('b2a19f'),
    workerName: 'Mitali Pal',
    amountPaise: 186_000,
    status: 'PROCESSING',
    batchLabel: '6 Oct',
  },
  {
    id: mockId('b377b0'),
    workerName: 'Rinita Bose',
    amountPaise: 92_000,
    status: 'FAILED',
    batchLabel: '4 Oct',
    failure: 'ACCOUNT_FROZEN',
  },
  {
    id: mockId('b43c2d'),
    workerName: 'Abdul Hossain',
    amountPaise: 110_000,
    status: 'QUEUED',
    batchLabel: '6 Oct',
  },
];

export const PAYOUT_HOLDS: readonly PayoutHold[] = [
  {
    workerId: mockId('77d2c8'),
    workerName: 'Bikash Roy',
    reasonCode: 'BANK_MISMATCH_SUSPECTED',
    note: 'Customer reported a different account holder on the UPI receipt.',
    placedLabel: '4 Oct 15:20',
  },
];

export const PAYOUT_HOLD_REASON_CODES = [
  'BANK_MISMATCH_SUSPECTED',
  'FRAUD_INVESTIGATION',
  'LEGAL_ORDER',
] as const;
export const PAYOUT_ACCOUNT_REJECT_REASON_CODES = [
  'NAME_MISMATCH',
  'THIRD_PARTY_ACCOUNT',
  'BUSINESS_ACCOUNT',
] as const;
/** Placeholder: the adjustment reason list is API-driven and not seeded in LLD-010. */
export const ADJUSTMENT_REASON_CODES = ['DOUBLE_FEE_CHARGED', 'FEE_CHARGED_IN_ERROR', 'GOODWILL'] as const;

export const WORKER_LEDGER: WorkerLedger = {
  workerId: DEMO_IDS.worker,
  workerName: 'Rinku Paul',
  openingBalanceLabel: '30 Sep 23:59',
  openingBalancePaise: -145_600,
  duesLimitPaise: 100_000,
  cashWithWorkerLast30DaysPaise: 1_045_000,
  earningsOnHoldPaise: 0,
  entries: [
    {
      id: mockId('e10001'),
      whenLabel: '1 Oct 18:30',
      transaction: 'CASH_COLLECTED',
      reference: { label: 'payment', id: mockId('5288a1') },
      direction: 'Dr',
      amountPaise: 23_600,
      postedBy: 'SYSTEM',
    },
    {
      id: mockId('e10002'),
      whenLabel: '2 Oct 19:15',
      transaction: 'ADJUSTMENT',
      reference: { label: 'adj', id: mockId('6409ef') },
      direction: 'Cr',
      amountPaise: 15_000,
      postedBy: 'Meera Iyer · DOUBLE_FEE_CHARGED',
    },
    {
      id: mockId('e10003'),
      whenLabel: '3 Oct 14:02',
      transaction: 'DUES_RECEIVED',
      reference: { label: 'payment', id: mockId('e4c6d3') },
      direction: 'Cr',
      amountPaise: 42_000,
      postedBy: 'SYSTEM',
    },
    {
      id: mockId('e10004'),
      whenLabel: 'Today 09:40',
      transaction: 'CASH_COLLECTED',
      reference: { label: 'payment', id: mockId('c13a90') },
      direction: 'Dr',
      amountPaise: 11_800,
      postedBy: 'SYSTEM',
    },
  ],
};

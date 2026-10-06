import { Ban, HandCoins, Hourglass, Landmark, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  Button,
  Card,
  CardHeader,
  CopyId,
  DataTable,
  EnumStatusChip,
  StatusChip,
  Tabs,
  type Column,
  type TabItem,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { formatMoney } from '@/lib/formatters';
import { PayoutAccountReviewCard } from '../components/PayoutAccountReviewCard';
import { PayoutHoldDialog } from '../components/PayoutHoldDialog';
import { PAYOUT_ACCOUNTS, PAYOUT_HOLDS, PAYOUTS } from '../mock-data';
import { getNameMatchScoreClassName } from '../name-match-band';
import { PAYOUT_ACCOUNT_STATUS_TONES, PAYOUT_STATUS_TONES } from '../status-tones';
import type { Payout, PayoutAccount, PayoutHold } from '../types';

type PayoutTab = 'NEEDS_REVIEW' | 'PENDING_VERIFICATION' | 'PAYOUTS' | 'HOLDS';

const countAccounts = (status: PayoutAccount['status']) =>
  PAYOUT_ACCOUNTS.filter((account) => account.status === status).length;

const PAYOUT_TABS: readonly TabItem<PayoutTab>[] = [
  { id: 'NEEDS_REVIEW', icon: Search, label: 'NEEDS_REVIEW', count: countAccounts('NEEDS_REVIEW') },
  {
    id: 'PENDING_VERIFICATION',
    icon: Hourglass,
    label: 'PENDING_VERIFICATION',
    count: countAccounts('PENDING_VERIFICATION'),
  },
  { id: 'PAYOUTS', icon: HandCoins, label: 'Payouts' },
  { id: 'HOLDS', icon: Ban, label: 'Payout holds', count: PAYOUT_HOLDS.length },
];

const payoutColumns: Column<Payout>[] = [
  { id: 'payout', header: 'Payout', cell: (payout) => <CopyId id={payout.id} /> },
  { id: 'worker', header: 'Worker', cell: (payout) => payout.workerName },
  {
    id: 'amount',
    header: 'Amount',
    align: 'right',
    className: 'font-semibold tabular-nums',
    cell: (payout) => formatMoney(payout.amountPaise),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (payout) => <EnumStatusChip status={payout.status} tones={PAYOUT_STATUS_TONES} />,
  },
  { id: 'batch', header: 'Batch', cell: (payout) => payout.batchLabel },
  {
    id: 'failure',
    header: 'Failure',
    className: 'font-mono text-xs',
    cell: (payout) => payout.failure ?? '—',
  },
];

const payoutHoldColumns: Column<PayoutHold>[] = [
  {
    id: 'worker',
    header: 'Worker',
    cell: (hold) => (
      <Link to={paths.worker(hold.workerId)} className="hover:text-primary font-semibold underline">
        {hold.workerName}
      </Link>
    ),
  },
  { id: 'reason', header: 'Reason', className: 'font-mono text-xs', cell: (hold) => hold.reasonCode },
  { id: 'note', header: 'Note', cell: (hold) => hold.note },
  { id: 'placed', header: 'Placed', cell: (hold) => hold.placedLabel },
  {
    id: 'actions',
    header: <span className="sr-only">Actions</span>,
    align: 'right',
    cell: () => (
      <RequirePermission permission="finance.payout">
        <Button size="sm" variant="secondary">
          Lift hold
        </Button>
      </RequirePermission>
    ),
  },
];

/** A-05d Payout accounts review + payout hold. */
export function PayoutAccountsPage() {
  const [activeTab, setActiveTab] = useState<PayoutTab>('NEEDS_REVIEW');
  const [selectedAccountId, setSelectedAccountId] = useState(PAYOUT_ACCOUNTS[0]?.id);
  const payoutHoldDialog = useUrlDialog('payout-hold');

  const accountsInTab = PAYOUT_ACCOUNTS.filter((account) => account.status === activeTab);
  const selectedAccount =
    accountsInTab.find((account) => account.id === selectedAccountId) ??
    accountsInTab[0] ??
    PAYOUT_ACCOUNTS[0];
  const selectedWorkerHold = PAYOUT_HOLDS.find((hold) => hold.workerId === selectedAccount?.workerId);
  const selectedFirstName = selectedAccount?.workerName.split(' ')[0];

  const accountColumns: Column<PayoutAccount>[] = [
    {
      id: 'worker',
      header: 'Worker',
      cell: (account) => (
        <span className="whitespace-nowrap">
          <button
            type="button"
            aria-pressed={account.id === selectedAccount?.id}
            onClick={() => setSelectedAccountId(account.id)}
            className="hover:text-primary cursor-pointer font-semibold"
          >
            {account.workerName}
          </button>{' '}
          <CopyId id={account.workerId} />
        </span>
      ),
    },
    {
      id: 'account',
      header: 'Account',
      cell: (account) => (
        <span className="whitespace-nowrap">
          <Landmark aria-hidden className="inline size-4" /> BANK ·· {account.accountLastFour} ·{' '}
          {account.ifsc}
        </span>
      ),
    },
    { id: 'bank-name', header: 'Bank name returned', cell: (account) => account.bankReturnedName },
    {
      id: 'score',
      header: 'Match score',
      cell: (account) =>
        account.pennyDropSucceeded ? (
          <b className={getNameMatchScoreClassName(account.nameMatchScore)}>{account.nameMatchScore}</b>
        ) : (
          '—'
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (account) => <EnumStatusChip status={account.status} tones={PAYOUT_ACCOUNT_STATUS_TONES} />,
    },
    { id: 'added', header: 'Added', cell: (account) => account.addedLabel },
  ];

  const recentPayoutsCard = (
    <Card>
      <CardHeader
        title={
          <>
            <HandCoins aria-hidden className="inline size-5" /> Recent payouts · daily batch 11:00 IST
          </>
        }
      />
      <DataTable
        dense
        caption="Recent payouts"
        columns={payoutColumns}
        rows={PAYOUTS}
        rowKey={(payout) => payout.id}
      />
    </Card>
  );

  const isAccountTab = activeTab === 'NEEDS_REVIEW' || activeTab === 'PENDING_VERIFICATION';

  return (
    <>
      <Tabs
        className="shrink-0"
        label="Payout account views"
        items={PAYOUT_TABS}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'PAYOUTS' && recentPayoutsCard}
      {activeTab === 'HOLDS' && (
        <DataTable
          caption="Payout holds"
          className="shrink-0"
          columns={payoutHoldColumns}
          rows={PAYOUT_HOLDS}
          rowKey={(hold) => hold.workerId}
          empty="No payout holds."
        />
      )}

      {isAccountTab && (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <DataTable
              caption={`Payout accounts in ${activeTab}`}
              columns={accountColumns}
              rows={accountsInTab}
              rowKey={(account) => account.id}
              rowClassName={(account) =>
                account.id === selectedAccount?.id ? 'bg-primary-subtle' : undefined
              }
              empty="No accounts in this state."
            />
            {recentPayoutsCard}
          </div>

          {selectedAccount && (
            <aside className="flex w-full flex-col gap-4 xl:w-[400px] xl:shrink-0">
              <PayoutAccountReviewCard key={selectedAccount.id} account={selectedAccount} />
              <Card aria-label="Payout hold">
                <header className="flex items-center justify-between gap-3">
                  <h3 className="text-h4 font-semibold">
                    <Ban aria-hidden className="inline size-5" /> Payout hold
                  </h3>
                  <StatusChip tone={selectedWorkerHold ? 'error' : 'neutral'}>
                    {selectedWorkerHold ? selectedWorkerHold.reasonCode : `none for ${selectedFirstName}`}
                  </StatusChip>
                </header>
                <p className="text-fg-muted text-[13px]">
                  Adds a NO_PAYOUTS restriction (source ADMIN) with reason + note. Earnings keep accruing;
                  lift any time.
                </p>
                <RequirePermission permission="finance.payout">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    onClick={() => payoutHoldDialog.openDialog()}
                  >
                    Put payouts on hold…
                  </Button>
                </RequirePermission>
              </Card>
            </aside>
          )}
        </div>
      )}

      {payoutHoldDialog.isOpen && selectedAccount && (
        <RequirePermission permission="finance.payout">
          <PayoutHoldDialog workerName={selectedAccount.workerName} onClose={payoutHoldDialog.closeDialog} />
        </RequirePermission>
      )}
    </>
  );
}

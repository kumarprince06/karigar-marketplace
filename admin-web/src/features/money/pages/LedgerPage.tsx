import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, CopyId, DataTable, KpiTile, ModalDialog, PermTag, type Column } from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { formatMoney, type Paise } from '@/lib/formatters';
import { mergeClassNames } from '@/lib/merge-class-names';
import { ManualAdjustmentForm } from '../components/ManualAdjustmentForm';
import { WORKER_LEDGER } from '../mock-data';
import { formatSignedMoney } from '../money-text';
import type { LedgerEntry } from '../types';

interface LedgerTableRow {
  key: string;
  whenLabel: string;
  /** Missing on the opening-balance row. */
  entry?: LedgerEntry;
  balanceAfterPaise: Paise;
}

/** Running WORKER_PAYABLE balance (Cr raises it, Dr lowers it), newest first, ending with the opening balance. */
function buildLedgerTableRows(): LedgerTableRow[] {
  let runningBalancePaise = WORKER_LEDGER.openingBalancePaise;
  const entryRows = WORKER_LEDGER.entries.map((entry) => {
    runningBalancePaise += entry.direction === 'Cr' ? entry.amountPaise : -entry.amountPaise;
    return { key: entry.id, whenLabel: entry.whenLabel, entry, balanceAfterPaise: runningBalancePaise };
  });
  return [
    ...entryRows.reverse(),
    {
      key: 'opening',
      whenLabel: WORKER_LEDGER.openingBalanceLabel,
      balanceAfterPaise: WORKER_LEDGER.openingBalancePaise,
    },
  ];
}

const ledgerColumns: Column<LedgerTableRow>[] = [
  { id: 'when', header: 'When', className: 'whitespace-nowrap', cell: (row) => row.whenLabel },
  {
    id: 'transaction',
    header: 'Transaction',
    className: 'font-mono text-xs',
    cell: (row) => row.entry?.transaction ?? <span className="text-fg-subtle">Opening balance</span>,
  },
  {
    id: 'reference',
    header: 'Reference',
    cell: (row) =>
      row.entry ? (
        <span className="text-fg-muted text-xs whitespace-nowrap">
          {row.entry.reference.label} <CopyId id={row.entry.reference.id} />
        </span>
      ) : (
        '—'
      ),
  },
  { id: 'direction', header: 'Dr / Cr', cell: (row) => row.entry?.direction ?? '—' },
  {
    id: 'amount',
    header: 'Amount',
    align: 'right',
    className: 'tabular-nums',
    cell: (row) => (row.entry ? formatMoney(row.entry.amountPaise) : '—'),
  },
  {
    id: 'balance',
    header: 'Balance',
    align: 'right',
    className: 'font-semibold tabular-nums',
    cell: (row) => formatSignedMoney(row.balanceAfterPaise),
  },
  { id: 'by', header: 'By', cell: (row) => row.entry?.postedBy ?? '—' },
];

/** A-05e Ledger: one worker's WORKER_PAYABLE balance and a manual adjustment (?dialog=adjustment). */
export function LedgerPage() {
  const adjustmentDialog = useUrlDialog('adjustment');
  const ledgerRows = buildLedgerTableRows();
  const currentBalancePaise = ledgerRows[0]?.balanceAfterPaise ?? WORKER_LEDGER.openingBalancePaise;
  const workerOwesPlatform = currentBalancePaise < 0;
  const overDuesLimitByPaise = -currentBalancePaise - WORKER_LEDGER.duesLimitPaise;

  return (
    <>
      <PageHeader
        className="flex-wrap"
        title={
          <>
            <Link to={paths.worker(WORKER_LEDGER.workerId)} className="hover:text-primary">
              {WORKER_LEDGER.workerName}
            </Link>{' '}
            <CopyId id={WORKER_LEDGER.workerId} />
          </>
        }
        actions={
          <RequirePermission permission="finance.adjust">
            <Button onClick={() => adjustmentDialog.openDialog()}>Manual adjustment…</Button>
          </RequirePermission>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card
          variant={workerOwesPlatform ? 'subtle' : 'brand'}
          className={mergeClassNames(
            'col-span-2 gap-0 xl:col-span-1',
            workerOwesPlatform && 'bg-danger shadow-e2 text-white',
          )}
        >
          <span className="text-[13px] text-white/90">WORKER_PAYABLE balance</span>
          <b className="text-[30px] leading-9 tabular-nums">{formatSignedMoney(currentBalancePaise)}</b>
          <span className="text-[13px] text-white/90">
            {workerOwesPlatform ? 'owes platform (cash-job fees)' : 'platform owes worker'}
          </span>
        </Card>
        <KpiTile
          label="Dues limit"
          value={formatMoney(WORKER_LEDGER.duesLimitPaise)}
          hint={
            overDuesLimitByPaise > 0 ? (
              <>
                over by {formatMoney(overDuesLimitByPaise)}{' '}
                <ArrowRight aria-hidden className="inline size-3.5" /> NO_NEW_OFFERS (DUES)
              </>
            ) : (
              'within limit'
            )
          }
        />
        <KpiTile
          label="CASH_WITH_WORKER (gross)"
          value={formatMoney(WORKER_LEDGER.cashWithWorkerLast30DaysPaise)}
          hint="last 30 days"
        />
        <KpiTile
          label="Earnings ON_HOLD"
          value={formatMoney(WORKER_LEDGER.earningsOnHoldPaise)}
          hint={WORKER_LEDGER.earningsOnHoldPaise > 0 ? 'held for an open dispute' : 'no open dispute'}
        />
      </div>

      <DataTable
        caption={`WORKER_PAYABLE ledger for ${WORKER_LEDGER.workerName}`}
        columns={ledgerColumns}
        rows={ledgerRows}
        rowKey={(row) => row.key}
        className="shrink-0"
      />

      {adjustmentDialog.isOpen && (
        <RequirePermission permission="finance.adjust">
          <ModalDialog
            open
            onClose={adjustmentDialog.closeDialog}
            title="Manual ledger adjustment"
            aside={<PermTag>finance.adjust</PermTag>}
            description={
              <>
                {WORKER_LEDGER.workerName} <CopyId id={WORKER_LEDGER.workerId} /> · current balance{' '}
                <b className="text-fg">{formatSignedMoney(currentBalancePaise)}</b>
              </>
            }
          >
            <ManualAdjustmentForm
              currentBalancePaise={currentBalancePaise}
              duesLimitPaise={WORKER_LEDGER.duesLimitPaise}
              onCancel={adjustmentDialog.closeDialog}
              onSubmitted={adjustmentDialog.closeDialog}
            />
          </ModalDialog>
        </RequirePermission>
      )}
    </>
  );
}

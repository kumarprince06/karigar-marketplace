import { FileText, Receipt } from 'lucide-react';
import { Card, SectionLabel } from '@/components/ui';
import { formatMoney } from '@/lib/formatters';
import type { ExtraWorkQuote, MaterialBill } from '../types';
import { MarketplaceStatusChip } from './MarketplaceStatusChip';

interface ExtraWorkAndMaterialsCardProps {
  quotes: readonly ExtraWorkQuote[];
  materialBills: readonly MaterialBill[];
}

const rowClassName = 'flex items-center justify-between gap-3 text-[13px]';

/** Extra work quotes and material bills (LLD-017). */
export function ExtraWorkAndMaterialsCard({ quotes, materialBills }: ExtraWorkAndMaterialsCardProps) {
  return (
    <Card className="flex-1">
      <h3 className="text-h4 flex items-center gap-1.5 font-semibold">
        <FileText aria-hidden className="size-4" /> Extra work quotes
      </h3>
      <ul className="flex flex-col gap-2">
        {quotes.map((quote) => (
          <li key={quote.id} className={rowClassName}>
            <span>
              {quote.description} · {formatMoney(quote.amount)}
              {quote.amountNote && ` ${quote.amountNote}`}
            </span>
            <MarketplaceStatusChip kind="quote" status={quote.status} />
          </li>
        ))}
      </ul>
      <SectionLabel className="mt-1 flex items-center gap-1.5">
        <Receipt aria-hidden className="size-3.5" /> Material bills
      </SectionLabel>
      <ul className="flex flex-col gap-2">
        {materialBills.map((bill) => (
          <li key={bill.id} className={rowClassName}>
            <span>
              {bill.description} · {formatMoney(bill.amount)}
              {bill.overQuote !== undefined && ` (${formatMoney(bill.overQuote)} over quote)`}
            </span>
            <MarketplaceStatusChip kind="materialBill" status={bill.status} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

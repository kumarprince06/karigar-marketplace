import { Globe, Lock, Pause, Play, Search, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, EmptyState, IconTile, Pill, StatusChip } from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import {
  CATALOG_CATEGORIES,
  CATALOG_SEARCH_MISSES,
  MISSING_TRANSLATION_COUNTS,
  TRADE_DETAILS,
} from '../catalog-mock-data';
import { EditCommonProblemDialog } from '../components/EditCommonProblemDialog';
import { TradeCategoryTree } from '../components/TradeCategoryTree';
import { TradeDetailSections } from '../components/TradeDetailSections';
import { CardTitle } from '../components/CardTitle';

const allTrades = CATALOG_CATEGORIES.flatMap((category) =>
  category.trades.map((trade) => ({ ...trade, categoryCode: category.code, categoryIcon: category.icon })),
);
const initialActiveTradeCodes = new Set(allTrades.filter((trade) => trade.active).map((trade) => trade.code));

/** A-06a catalog trade editor and A-06b edit common problem (?dialog=edit-problem&problem=CODE). */
export function CatalogPage() {
  const editProblemDialog = useUrlDialog('edit-problem');
  const [selectedTradeCode, setSelectedTradeCode] = useState('ELECTRICIAN');
  const [activeTradeCodes, setActiveTradeCodes] = useState<ReadonlySet<string>>(initialActiveTradeCodes);

  const selectedTrade = allTrades.find((trade) => trade.code === selectedTradeCode) ?? allTrades[0]!;
  const tradeDetail = TRADE_DETAILS.find((detail) => detail.tradeCode === selectedTrade.code);
  const isSelectedTradeActive = activeTradeCodes.has(selectedTrade.code);

  const handleToggleTradeActive = (tradeCode: string, active: boolean) => {
    const nextActiveTradeCodes = new Set(activeTradeCodes);
    if (active) nextActiveTradeCodes.add(tradeCode);
    else nextActiveTradeCodes.delete(tradeCode);
    setActiveTradeCodes(nextActiveTradeCodes);
  };

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <TradeCategoryTree
        categories={CATALOG_CATEGORIES}
        activeTradeCodes={activeTradeCodes}
        selectedTradeCode={selectedTrade.code}
        onSelectTrade={setSelectedTradeCode}
        onToggleTradeActive={handleToggleTradeActive}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Card variant="brand" className="flex-col items-start gap-4 px-5 py-4 sm:flex-row sm:items-center">
          <IconTile icon={selectedTrade.categoryIcon} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-h3">{selectedTrade.name}</b>
              <Pill>{isSelectedTradeActive ? 'ACTIVE · live in app' : 'INACTIVE · hidden in app'}</Pill>
            </div>
            <span className="text-sm break-words text-white/90">
              code <span className="font-mono text-[13px]">{selectedTrade.code}</span>{' '}
              <Lock aria-hidden className="inline size-3.5 align-[-2px]" /> immutable · category{' '}
              {selectedTrade.categoryCode}
            </span>
          </div>
          <RequirePermission permission="catalog.manage">
            <Button
              variant="ghost"
              className="bg-white/16 text-white hover:bg-white/25"
              onClick={() => handleToggleTradeActive(selectedTrade.code, !isSelectedTradeActive)}
            >
              {isSelectedTradeActive ? (
                <>
                  <Pause aria-hidden className="size-4" /> Deactivate trade
                </>
              ) : (
                <>
                  <Play aria-hidden className="size-4" /> Activate trade
                </>
              )}
            </Button>
          </RequirePermission>
        </Card>

        {tradeDetail ? (
          <TradeDetailSections
            key={tradeDetail.tradeCode}
            tradeDetail={tradeDetail}
            onEditProblem={(problemCode) => editProblemDialog.openDialog({ problem: problemCode })}
          />
        ) : (
          <Card>
            <EmptyState icon={Wrench} title="No skills or common problems yet">
              Add skills and common problems before activating this trade.
            </EmptyState>
          </Card>
        )}
      </div>

      <aside className="grid gap-3 md:grid-cols-2 xl:flex xl:w-[230px] xl:shrink-0 xl:flex-col">
        <Card>
          <CardTitle icon={Search}>
            Search misses <StatusChip>bn</StatusChip>
          </CardTitle>
          <ul className="flex flex-col gap-1 text-sm">
            {CATALOG_SEARCH_MISSES.map((miss) => (
              <li key={miss.term} className="flex justify-between gap-2">
                <span lang={miss.locale}>{miss.term}</span>
                <b>{miss.count}</b>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted text-[13px] leading-[18px]">Add these as keywords on a problem.</p>
        </Card>
        <Card>
          <CardTitle icon={Globe}>Missing translations</CardTitle>
          <ul className="flex flex-col gap-1 text-sm">
            {MISSING_TRANSLATION_COUNTS.map((missing) => (
              <li key={missing.locale} className="flex items-center justify-between">
                <span>{missing.locale}</span>
                <StatusChip tone="warning">{missing.count}</StatusChip>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted text-[13px] leading-[18px]">
            Missing text falls back to English in the app.
          </p>
        </Card>
      </aside>

      {tradeDetail && (
        <EditCommonProblemDialog
          open={editProblemDialog.isOpen}
          onClose={editProblemDialog.closeDialog}
          tradeName={selectedTrade.name}
          trade={tradeDetail}
          problem={
            tradeDetail.problems.find(
              (problem) => problem.code === editProblemDialog.params.get('problem'),
            ) ??
            tradeDetail.problems.find((problem) => problem.code === 'MCB_TRIPPING') ??
            tradeDetail.problems[0]!
          }
        />
      )}
    </div>
  );
}

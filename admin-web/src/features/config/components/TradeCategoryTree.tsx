import { Search } from 'lucide-react';
import { useState } from 'react';
import { Card, Input, StatusChip, ToggleSwitch } from '@/components/ui';
import { mergeClassNames } from '@/lib/merge-class-names';
import type { CatalogCategory } from '../types';

interface TradeCategoryTreeProps {
  categories: readonly CatalogCategory[];
  activeTradeCodes: ReadonlySet<string>;
  selectedTradeCode: string;
  onSelectTrade: (tradeCode: string) => void;
  onToggleTradeActive: (tradeCode: string, active: boolean) => void;
}

/** Category and trade tree with the active flag per trade (A-06a). A category is live when any trade is active. */
export function TradeCategoryTree({
  categories,
  activeTradeCodes,
  selectedTradeCode,
  onSelectTrade,
  onToggleTradeActive,
}: TradeCategoryTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleCategories = categories
    .map((category) => ({
      ...category,
      trades: category.trades.filter((trade) => trade.name.toLowerCase().includes(normalizedQuery)),
    }))
    .filter((category) => !normalizedQuery || category.trades.length > 0);

  return (
    <Card padding="none" className="gap-1 p-2.5 xl:w-60 xl:shrink-0">
      <Input
        type="search"
        leading={<Search aria-hidden className="size-4" />}
        placeholder="Find trade / problem"
        aria-label="Find trade or problem"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        className="min-h-9 text-[13px]"
      />
      <ul className="flex flex-col gap-0.5 text-[13px]">
        {visibleCategories.map((category) => {
          const liveTradeCount = category.trades.filter((trade) => activeTradeCodes.has(trade.code)).length;
          return (
            <li key={category.code}>
              <p className="flex items-center justify-between px-2 pt-2 pb-1 font-bold">
                <span className="flex min-w-0 items-center gap-1.5">
                  <category.icon aria-hidden className="text-primary size-4 shrink-0" />
                  {category.name}
                </span>
                {liveTradeCount > 0 ? (
                  <StatusChip tone="success" className="text-[11px]">
                    {liveTradeCount} live
                  </StatusChip>
                ) : (
                  <span className="text-fg-subtle font-normal">hidden</span>
                )}
              </p>
              <ul className="flex flex-col gap-0.5">
                {category.trades.map((trade) => {
                  const isActive = activeTradeCodes.has(trade.code);
                  const isSelected = trade.code === selectedTradeCode;
                  return (
                    <li
                      key={trade.code}
                      className={mergeClassNames(
                        'flex items-center justify-between rounded-lg py-1.5 pr-2 pl-[22px]',
                        isSelected && 'bg-primary-subtle text-primary font-semibold',
                        !isSelected && !isActive && 'text-fg-subtle',
                      )}
                    >
                      <button
                        type="button"
                        aria-current={isSelected ? 'true' : undefined}
                        onClick={() => onSelectTrade(trade.code)}
                        className="hover:text-primary flex-1 cursor-pointer text-left"
                      >
                        {trade.name}
                      </button>
                      <ToggleSwitch
                        size="sm"
                        hideLabel
                        label={`${trade.name} active`}
                        checked={isActive}
                        onChange={(checked) => onToggleTradeActive(trade.code, checked)}
                      />
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="text-fg-muted px-2 py-1 text-[13px] leading-[18px]">
        A category shows in the app only when it has an active trade. Rows are never deleted.
      </p>
    </Card>
  );
}

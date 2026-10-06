import { Check, Eye, Globe, Lock } from 'lucide-react';
import { useState } from 'react';
import { AlertBanner, Card, DataTable, StatusChip, type Column } from '@/components/ui';
import { formatMoney } from '@/lib/formatters';
import { mergeClassNames } from '@/lib/merge-class-names';
import { SettingsAndReasonCodesTabs } from '../components/SettingsAndReasonCodesTabs';
import { getMissingLocales } from '../config-formatters';
import { REASON_CODE_CATEGORIES, REASON_CODES_BY_CATEGORY } from '../staff-and-settings-mock-data';
import { ACTIVE_FLAG_CHIP } from '../status-chip-styles';
import type { Locale, ReasonCode } from '../types';

const renderTranslatedLabel = (reasonCode: ReasonCode, locale: Locale) =>
  reasonCode.labels[locale] ? (
    <span lang={locale}>{reasonCode.labels[locale]}</span>
  ) : (
    <StatusChip tone="warning" className="whitespace-normal">
      missing translation
    </StatusChip>
  );

const renderYesFlag = (isSet: boolean, absentText = '—') =>
  isSet ? (
    <span className="inline-flex items-center gap-1">
      <Check aria-hidden className="size-3.5" /> yes
    </span>
  ) : (
    <span className="text-fg-subtle">{absentText}</span>
  );

const reasonCodeColumns: Column<ReasonCode>[] = [
  {
    id: 'sort',
    header: <span className="whitespace-normal">Sort order</span>,
    cell: (reasonCode) => reasonCode.sortOrder,
  },
  { id: 'code', header: 'Code', cell: (reasonCode) => <span className="font-mono">{reasonCode.code}</span> },
  { id: 'en', header: 'Label · en', cell: (reasonCode) => reasonCode.labels.en },
  {
    id: 'bn',
    header: <span lang="bn">বাংলা</span>,
    cell: (reasonCode) => renderTranslatedLabel(reasonCode, 'bn'),
  },
  {
    id: 'hi',
    header: <span lang="hi">हिंदी</span>,
    cell: (reasonCode) => renderTranslatedLabel(reasonCode, 'hi'),
  },
  {
    id: 'note',
    header: <span className="whitespace-normal">Requires note</span>,
    cell: (reasonCode) => renderYesFlag(reasonCode.requiresNote),
  },
  {
    id: 'fee',
    header: <span className="whitespace-normal">Cancellation fee applies</span>,
    cell: (reasonCode) => renderYesFlag(reasonCode.cancellationFeeApplies, '— no fee'),
  },
  {
    id: 'active',
    header: 'Active',
    cell: (reasonCode) => {
      const chip = ACTIVE_FLAG_CHIP[`${reasonCode.active}`];
      return <StatusChip tone={chip.tone}>{chip.label}</StatusChip>;
    },
  },
];

/** A-06j reason codes. Read-only: codes come from each module's R__ migration (LLD-022). */
export function ReasonCodesPage() {
  const [selectedCategoryCode, setSelectedCategoryCode] = useState(REASON_CODE_CATEGORIES[0]!.code);
  const selectedCategory =
    REASON_CODE_CATEGORIES.find((category) => category.code === selectedCategoryCode) ??
    REASON_CODE_CATEGORIES[0]!;
  const reasonCodes = REASON_CODES_BY_CATEGORY[selectedCategory.code] ?? [];
  const missingCounts = (['bn', 'hi'] as const).map((locale) => ({
    locale,
    count: reasonCodes.filter((reasonCode) => getMissingLocales(reasonCode.labels).includes(locale)).length,
  }));

  return (
    <>
      <SettingsAndReasonCodesTabs
        aside={
          <StatusChip>
            <Eye aria-hidden className="size-3.5" /> ops.view
          </StatusChip>
        }
      />
      <AlertBanner tone="neutral" icon={Lock}>
        <b>Read-only</b> — codes are added by each module&apos;s <span className="font-mono">R__</span>{' '}
        migration (LLD-022); changes go through a release. Missing labels fall back to English.
      </AlertBanner>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <Card padding="none" className="gap-0.5 p-2.5 xl:w-[272px] xl:shrink-0">
          <p className="flex justify-between px-2 pt-2 pb-1 text-[13px] font-bold">
            <span>Category</span>
            <span className="text-fg-subtle font-normal">codes</span>
          </p>
          <ul className="grid gap-0.5 text-[13px] sm:grid-cols-2 xl:grid-cols-1">
            {REASON_CODE_CATEGORIES.map((category) => {
              const isSelected = category.code === selectedCategory.code;
              return (
                <li key={category.code}>
                  <button
                    type="button"
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => setSelectedCategoryCode(category.code)}
                    className={mergeClassNames(
                      'hover:text-primary flex w-full cursor-pointer justify-between rounded-lg py-1.5 pr-2 pl-[22px] text-left',
                      isSelected && 'bg-primary-subtle text-primary font-semibold',
                    )}
                  >
                    <span className="font-mono">{category.code}</span>
                    <span>{category.codeCount}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-fg-muted px-2 py-1.5 text-[13px] leading-[18px]">
            Rows are never deleted; a retired code is set inactive.
          </p>
        </Card>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="font-mono text-base font-semibold">{selectedCategory.code}</h3>
              <StatusChip tone="brand">{selectedCategory.ownerSeed} · R__ seed</StatusChip>
            </div>
            <div className="flex items-center gap-2">
              {missingCounts
                .filter((missing) => missing.count > 0)
                .map((missing, index) => (
                  <StatusChip key={missing.locale} tone="warning">
                    {index === 0 && <Globe aria-hidden className="size-3.5" />}
                    {missing.count} missing {missing.locale}
                  </StatusChip>
                ))}
            </div>
          </div>
          <DataTable
            dense
            caption={`${selectedCategory.code} reason codes`}
            columns={reasonCodeColumns}
            rows={reasonCodes}
            rowKey={(reasonCode) => reasonCode.code}
            empty={`${selectedCategory.codeCount} codes, seeded by ${selectedCategory.ownerSeed}.`}
          />
          <AlertBanner tone="info">
            <b>Cancellation fee applies</b> only matters inside the late window (2 h before the visit, fee
            min(advance, {formatMoney(10000)})). A code without it never charges the customer, e.g. when the
            worker is late.
          </AlertBanner>
        </div>
      </div>
    </>
  );
}

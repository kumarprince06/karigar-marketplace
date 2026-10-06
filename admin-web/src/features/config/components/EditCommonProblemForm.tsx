import { Lock, Pause, Search, Siren, Smartphone, Languages, Zap } from 'lucide-react';
import { useState } from 'react';
import {
  AlertBanner,
  Button,
  Card,
  Field,
  IconTile,
  Input,
  RadioOrCheckbox,
  Select,
  SegmentedControl,
  StatusChip,
  Textarea,
} from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { LOCALE_NAMES, LOCALES, PROBLEM_MATCHING_MISSES } from '../catalog-mock-data';
import { formatPriceGuide, getMissingLocales } from '../config-formatters';
import type { CommonProblem, Locale, TradeDetail } from '../types';
import { CardTitle } from './CardTitle';

interface EditCommonProblemFormProps {
  trade: TradeDetail;
  problem: CommonProblem;
  onClose: () => void;
}

/** App preview copy per locale ("typical price", "min"). */
const PREVIEW_COPY: Record<Locale, { typicalPrice: string; minutes: string; needsInspection: string }> = {
  en: { typicalPrice: 'Typical price', minutes: 'min', needsInspection: 'Price after inspection' },
  bn: { typicalPrice: 'সাধারণ দাম', minutes: 'মিনিট', needsInspection: 'দেখে দাম বলা হবে' },
  hi: { typicalPrice: 'आम कीमत', minutes: 'मिनट', needsInspection: 'जांच के बाद कीमत' },
};

const toRupeesText = (paise: number | undefined) => (paise === undefined ? '' : String(paise / 100));
const toPaise = (rupeesText: string) => Math.round(Number(rupeesText || 0) * 100);

/**
 * A-06b: edit a common problem's basics and one locale's title + search keywords.
 * Body of EditCommonProblemDialog; static design, so Save just closes.
 */
export function EditCommonProblemForm({ trade, problem, onClose }: EditCommonProblemFormProps) {
  const missingLocales = getMissingLocales(problem.titles);
  const [selectedLocale, setSelectedLocale] = useState<Locale>(missingLocales[0] ?? 'en');
  const [skill, setSkill] = useState(problem.skill);
  const [estimatedMinutes, setEstimatedMinutes] = useState(String(problem.estimatedMinutes));
  const [sortOrder, setSortOrder] = useState(String(problem.sortOrder));
  const [priceFromRupees, setPriceFromRupees] = useState(toRupeesText(problem.priceGuide?.fromPaise));
  const [priceToRupees, setPriceToRupees] = useState(toRupeesText(problem.priceGuide?.toPaise));
  const [needsInspection, setNeedsInspection] = useState(problem.priceGuide === null);
  const [titles, setTitles] = useState(problem.titles);
  const [keywords, setKeywords] = useState(problem.keywords);

  const otherLocales = LOCALES.filter((locale) => locale !== selectedLocale);
  const previewTitle = titles[selectedLocale] || titles.en;
  const previewCopy = PREVIEW_COPY[selectedLocale];
  const previewPriceGuide = needsInspection
    ? null
    : { fromPaise: toPaise(priceFromRupees), toPaise: toPaise(priceToRupees) };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <Card className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-h4 font-semibold">Basics</h3>
            <span className="text-fg-muted inline-flex items-center gap-1 text-sm">
              code <span className="font-mono text-[13px]">{problem.code}</span>
              <Lock aria-hidden className="size-3.5" />
              <span className="sr-only">(cannot be changed)</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Skill" className="col-span-2 sm:col-span-1">
              {({ id }) => (
                <Select id={id} value={skill} onChange={(event) => setSkill(event.target.value)}>
                  {trade.skills.map((tradeSkill) => (
                    <option key={tradeSkill.name}>{tradeSkill.name}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Estimated time" hint="(min)">
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={estimatedMinutes}
                  onChange={(event) => setEstimatedMinutes(event.target.value)}
                />
              )}
            </Field>
            <Field label="Sort order">
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:items-end">
            <Field label="Price guide from">
              {({ id }) => (
                <Input
                  id={id}
                  leading="₹"
                  inputMode="numeric"
                  disabled={needsInspection}
                  value={priceFromRupees}
                  onChange={(event) => setPriceFromRupees(event.target.value)}
                />
              )}
            </Field>
            <Field label="to">
              {({ id }) => (
                <Input
                  id={id}
                  leading="₹"
                  inputMode="numeric"
                  disabled={needsInspection}
                  value={priceToRupees}
                  onChange={(event) => setPriceToRupees(event.target.value)}
                />
              )}
            </Field>
            <RadioOrCheckbox
              type="checkbox"
              label="Needs inspection (no price guide)"
              checked={needsInspection}
              onChange={(event) => setNeedsInspection(event.target.checked)}
              className="col-span-2 items-center sm:col-span-1"
            />
          </div>
        </Card>

        <Card className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle icon={Languages}>Title &amp; search keywords</CardTitle>
            {missingLocales.length > 0 && (
              <StatusChip tone="warning">{missingLocales.join(' ')} missing</StatusChip>
            )}
            <SegmentedControl
              label="Translation language"
              className="w-full sm:w-[300px]"
              value={selectedLocale}
              onChange={setSelectedLocale}
              options={LOCALES.map((locale) => ({
                value: locale,
                label: LOCALE_NAMES[locale],
              }))}
            />
          </div>
          <Field label={`Title (${selectedLocale})`}>
            {({ id }) => (
              <Input
                id={id}
                lang={selectedLocale}
                value={titles[selectedLocale] ?? ''}
                onChange={(event) => setTitles({ ...titles, [selectedLocale]: event.target.value })}
              />
            )}
          </Field>
          <Field label="Keywords" hint="(comma-separated; include romanised spellings)">
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                lang={selectedLocale}
                value={keywords[selectedLocale] ?? ''}
                onChange={(event) => setKeywords({ ...keywords, [selectedLocale]: event.target.value })}
              />
            )}
          </Field>
          <AlertBanner tone="info" icon={Languages}>
            {otherLocales.map((locale, index) => (
              <span key={locale}>
                {index > 0 && ' · '}
                {LOCALE_NAMES[locale]}:{' '}
                {titles[locale] ? <b lang={locale}>{titles[locale]}</b> : <i>missing</i>}
                {keywords[locale] && (
                  <>
                    {' '}
                    · keywords <i lang={locale}>{keywords[locale]}</i>
                  </>
                )}
              </span>
            ))}
          </AlertBanner>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <RequirePermission permission="catalog.manage">
            <Button variant="secondary" onClick={onClose}>
              <Pause aria-hidden className="size-4" /> Deactivate problem
            </Button>
            <Button onClick={onClose}>Save {selectedLocale} translation</Button>
          </RequirePermission>
        </div>
      </div>

      <aside className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
        <Card className="gap-2">
          <CardTitle icon={Smartphone}>Preview in app ({selectedLocale})</CardTitle>
          <Card variant="flat" className="bg-canvas gap-1.5">
            <div className="flex items-center gap-2">
              <IconTile icon={Zap} size="sm" />
              <b lang={selectedLocale}>{previewTitle}</b>
            </div>
            <span className="text-fg-muted text-sm" lang={selectedLocale}>
              {previewPriceGuide ? (
                <>
                  {previewCopy.typicalPrice}{' '}
                  <b className="tabular-nums">{formatPriceGuide(previewPriceGuide)}</b>
                </>
              ) : (
                previewCopy.needsInspection
              )}{' '}
              · ~{estimatedMinutes} {previewCopy.minutes}
            </span>
            {problem.emergency && (
              <StatusChip tone="error" className="self-start">
                <Siren aria-hidden className="size-3.5" /> Emergency available
              </StatusChip>
            )}
          </Card>
          <p className="text-fg-muted text-[13px] leading-[18px]">
            Indic text uses Anek Devanagari / Bangla with line-height ≥ 1.5.
          </p>
        </Card>
        <Card>
          <CardTitle icon={Search}>Recent misses matching</CardTitle>
          <ul className="flex flex-col gap-1 text-sm">
            {PROBLEM_MATCHING_MISSES.map((miss) => (
              <li key={miss.term} className="flex justify-between gap-2">
                <span>&quot;{miss.term}&quot;</span>
                <b>{miss.count}</b>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}

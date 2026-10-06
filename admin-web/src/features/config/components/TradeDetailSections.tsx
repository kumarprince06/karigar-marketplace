import { Globe, Settings, Siren, Wrench } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  Card,
  DataTable,
  KeyValueList,
  Select,
  StatusChip,
  ToggleSwitch,
  type Column,
} from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { formatMoney } from '@/lib/formatters';
import { RATE_TYPES } from '../catalog-mock-data';
import { formatPriceGuide, getMissingLocales } from '../config-formatters';
import type { CommonProblem, RateType, TradeDetail } from '../types';
import { CardTitle } from './CardTitle';

interface TradeDetailSectionsProps {
  tradeDetail: TradeDetail;
  onEditProblem: (problemCode: string) => void;
}

/** Names, trade settings, skills and the common problems table for one trade (A-06a). */
export function TradeDetailSections({ tradeDetail, onEditProblem }: TradeDetailSectionsProps) {
  const [defaultRateType, setDefaultRateType] = useState<RateType>(tradeDetail.defaultRateType);
  const [emergencyEnabled, setEmergencyEnabled] = useState(tradeDetail.emergencyEnabled);
  const [activeProblemCodes, setActiveProblemCodes] = useState<ReadonlySet<string>>(
    () => new Set(tradeDetail.problems.filter((problem) => problem.active).map((problem) => problem.code)),
  );

  const handleToggleProblemActive = (problemCode: string, active: boolean) => {
    const nextActiveProblemCodes = new Set(activeProblemCodes);
    if (active) nextActiveProblemCodes.add(problemCode);
    else nextActiveProblemCodes.delete(problemCode);
    setActiveProblemCodes(nextActiveProblemCodes);
  };

  const problemColumns: Column<CommonProblem>[] = [
    { id: 'title', header: 'Common problem', cell: (problem) => problem.titles.en },
    { id: 'skill', header: 'Skill', cell: (problem) => problem.skill },
    {
      id: 'price',
      header: 'Price guide',
      cell: (problem) =>
        problem.priceGuide ? (
          <span className="font-semibold whitespace-nowrap tabular-nums">
            {formatPriceGuide(problem.priceGuide)}
          </span>
        ) : (
          <StatusChip tone="info">Needs inspection</StatusChip>
        ),
    },
    {
      id: 'emergency',
      header: 'Emergency',
      cell: (problem) =>
        problem.emergency ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Siren aria-hidden className="text-error size-4" /> yes
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'translations',
      header: 'Translations',
      cell: (problem) => {
        const missingLocales = getMissingLocales(problem.titles);
        return missingLocales.length === 0 ? (
          <StatusChip tone="success">en bn hi</StatusChip>
        ) : (
          <StatusChip tone="warning">{missingLocales.join(' ')} missing</StatusChip>
        );
      },
    },
    {
      id: 'active',
      header: 'Active',
      cell: (problem) => (
        <ToggleSwitch
          size="sm"
          hideLabel
          label={`${problem.titles.en} active`}
          checked={activeProblemCodes.has(problem.code)}
          onChange={(checked) => handleToggleProblemActive(problem.code, checked)}
        />
      ),
    },
    {
      id: 'edit',
      header: <span className="sr-only">Actions</span>,
      cell: (problem) => (
        <RequirePermission permission="catalog.manage">
          <Button variant="ghost" size="sm" onClick={() => onEditProblem(problem.code)}>
            Edit<span className="sr-only"> {problem.titles.en}</span>
          </Button>
        </RequirePermission>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <Card className="min-w-0 flex-1">
          <CardTitle icon={Globe}>Names</CardTitle>
          <KeyValueList
            labelWidth="lg"
            items={[
              { label: 'en', value: tradeDetail.names.en },
              {
                label: <span lang="bn">bn · বাংলা</span>,
                value: <span lang="bn">{tradeDetail.names.bn}</span>,
              },
              {
                label: <span lang="hi">hi · हिन्दी</span>,
                value: <span lang="hi">{tradeDetail.names.hi}</span>,
              },
            ]}
          />
        </Card>
        <Card className="min-w-0 flex-1">
          <CardTitle icon={Settings}>Trade settings</CardTitle>
          <KeyValueList
            labelWidth="lg"
            items={[
              {
                label: 'Default rate type',
                value: (
                  <Select
                    aria-label="Default rate type"
                    className="min-h-8 w-auto text-[13px]"
                    value={defaultRateType}
                    onChange={(event) => setDefaultRateType(event.target.value as RateType)}
                  >
                    {RATE_TYPES.map((rateType) => (
                      <option key={rateType}>{rateType}</option>
                    ))}
                  </Select>
                ),
              },
              {
                label: 'Emergency',
                value: (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <ToggleSwitch
                      size="sm"
                      hideLabel
                      label="Emergency bookings enabled"
                      checked={emergencyEnabled}
                      onChange={setEmergencyEnabled}
                    />
                    {emergencyEnabled ? 'enabled' : 'disabled'} · surcharge{' '}
                    <b>{formatMoney(tradeDetail.emergencySurchargePaise)}</b>
                  </span>
                ),
              },
              {
                label: 'Advance',
                value: (
                  <>
                    <b>{formatMoney(tradeDetail.advancePaise)}</b> (always online)
                  </>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Card className="gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle icon={Wrench}>
            Skills{' '}
            <span className="text-fg-subtle text-sm font-normal">
              (profile info only; matching is by trade)
            </span>
          </CardTitle>
          <RequirePermission permission="catalog.manage">
            <Button variant="ghost" size="sm">
              + Skill
            </Button>
          </RequirePermission>
        </div>
        <ul className="flex flex-wrap gap-2">
          {tradeDetail.skills.map((skill) => (
            <li key={skill.name}>
              <StatusChip tone={skill.active ? 'brand' : 'neutral'}>
                {skill.name}
                {!skill.active && ' · inactive'}
              </StatusChip>
            </li>
          ))}
        </ul>
      </Card>

      <DataTable
        dense
        caption="Common problems"
        columns={problemColumns}
        rows={tradeDetail.problems}
        rowKey={(problem) => problem.code}
      />
    </>
  );
}

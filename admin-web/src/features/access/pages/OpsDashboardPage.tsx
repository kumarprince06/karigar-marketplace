import { ArrowUpRight, ChartLine, Hand } from 'lucide-react';
import { useState } from 'react';
import {
  buttonVariants,
  Card,
  CardHeader,
  KpiTile,
  PermTag,
  SegmentedControl,
  StatusChip,
} from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { GRAFANA_URL } from '@/config/route-paths';
import { useSession, type Permission } from '@/features/auth';
import { formatMoney } from '@/lib/formatters';
import { QueueSummaryCard } from '../components/QueueSummaryCard';
import { TODAY_KPIS } from '../mock-data';
import { useVisibleOpsQueues } from '../useVisibleOpsQueues';

type ZoneFilter = 'ALL' | 'HOWRAH';

const ZONE_OPTIONS: readonly { value: ZoneFilter; label: string }[] = [
  { value: 'ALL', label: 'All zones' },
  { value: 'HOWRAH', label: 'Howrah' },
];

/** Permissions listed first on "Your access"; the rest are summarised as "+N". */
const HIGHLIGHTED_PERMISSIONS: readonly Permission[] = [
  'ops.view',
  'ops.act',
  'finance.view',
  'dispute.manage',
  'verification.review',
];
const HIGHLIGHTED_PERMISSION_LIMIT = 4;

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** A-01e Ops dashboard: the 7 ops queues filtered by the caller's permissions (LLD-020 §3.3). */
export function OpsDashboardPage() {
  const { session } = useSession();
  const visibleQueues = useVisibleOpsQueues();
  // ponytail: zone is a filter only (D4); MVP grants are global so the mock counts don't change.
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('ALL');

  const firstName = session.name.split(' ')[0];
  const highlightedPermissions = HIGHLIGHTED_PERMISSIONS.filter((permission) =>
    session.permissions.has(permission),
  ).slice(0, HIGHLIGHTED_PERMISSION_LIMIT);
  const otherPermissionCount = session.permissions.size - highlightedPermissions.length;

  return (
    <>
      <PageHeader
        title={
          <>
            {greetingForHour(new Date().getHours())}, {firstName}{' '}
            <Hand aria-hidden className="text-accent inline size-6 align-[-4px]" />
          </>
        }
        description={`${visibleQueues.length} queues you can see · oldest first inside each queue · counts are live`}
        actions={
          <>
            <span className="text-fg-muted text-sm">Zone</span>
            <SegmentedControl
              label="Zone"
              options={ZONE_OPTIONS}
              value={zoneFilter}
              onChange={setZoneFilter}
              className="w-[260px]"
            />
          </>
        }
        className="flex-wrap items-center"
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {visibleQueues.map((queue) => (
          <QueueSummaryCard key={queue.code} queue={queue} />
        ))}
        <Card variant="brand" className="gap-2.5">
          <h3 className="text-h4 flex items-center gap-2 font-bold">
            <ChartLine aria-hidden className="size-5" /> Metrics &amp; system health
          </h3>
          <p className="text-sm opacity-90">
            Funnels, matching time, payment success, API latency and alerts live in Grafana — not in this
            console.
          </p>
          <div className="flex-1" />
          <a
            href={GRAFANA_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'accent', className: 'self-start' })}
          >
            Open Grafana <ArrowUpRight aria-hidden className="size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Card>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <Card className="min-w-0 flex-1 gap-3">
          <CardHeader
            title="Today so far"
            aside={<span className="text-fg-muted text-sm">{session.zone} · since 00:00 IST</span>}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
            {TODAY_KPIS.map((kpi) => (
              <KpiTile
                key={kpi.label}
                label={kpi.label}
                value={kpi.isMoney ? formatMoney(kpi.value) : kpi.value}
                hint={kpi.hint}
              />
            ))}
          </div>
        </Card>

        <Card className="shrink-0 xl:w-[380px]">
          <CardHeader title="Your access" aside={<StatusChip tone="brand">{session.role}</StatusChip>} />
          <p className="text-fg-muted text-sm">
            Queues are shown only when you hold their view permission. A Support Agent sees 4 of these 7 (no
            verification or finance queues).
          </p>
          <div className="flex flex-wrap gap-2">
            {highlightedPermissions.map((permission) => (
              <PermTag key={permission}>{permission}</PermTag>
            ))}
            {otherPermissionCount > 0 && <PermTag>+{otherPermissionCount}</PermTag>}
          </div>
        </Card>
      </div>
    </>
  );
}

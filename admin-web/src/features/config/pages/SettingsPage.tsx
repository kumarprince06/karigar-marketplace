import { Lock } from 'lucide-react';
import { AlertBanner, Card, StatusChip } from '@/components/ui';
import { CardTitle } from '../components/CardTitle';
import { SettingsAndReasonCodesTabs } from '../components/SettingsAndReasonCodesTabs';
import { SETTINGS_GROUPS } from '../staff-and-settings-mock-data';

/** A-06i platform settings: a read-only config snapshot (P7). No edit controls by design. */
export function SettingsPage() {
  return (
    <>
      <SettingsAndReasonCodesTabs />
      <AlertBanner tone="neutral" icon={Lock}>
        <b>Read-only.</b> These values come from configuration and migrations; changing one is a code change
        with review. Service zones are edited in <b>Service zones</b>, trade settings in <b>Catalog</b>. No
        maintenance-mode switch.
      </AlertBanner>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_GROUPS.map((group) => (
          <Card key={group.title} className="gap-1">
            <CardTitle icon={group.icon}>{group.title}</CardTitle>
            {group.rows && (
              <dl className="flex flex-col gap-1 text-[13px]">
                {group.rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-2">
                    <dt>{row.label}</dt>
                    <dd className="text-right font-bold">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {group.chips && (
              <ul className="flex flex-wrap gap-2">
                {group.chips.map((chip) => (
                  <li key={chip.label}>
                    <StatusChip tone="brand" lang={chip.lang}>
                      {chip.label}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            )}
            {group.description && (
              <p className={group.chips ? 'text-fg-muted text-sm' : 'text-sm'}>{group.description}</p>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

import { Compass, Mailbox, Map, Megaphone, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { AlertBanner, Button, Card, IconTile, Pill, SegmentedControl } from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { SERVICE_ZONE_STATUS_CHIP } from '../status-chip-styles';
import type { ServiceZone, ServiceZoneStatus } from '../types';
import { CardTitle } from './CardTitle';

const ZONE_STATUS_OPTIONS = (Object.keys(SERVICE_ZONE_STATUS_CHIP) as ServiceZoneStatus[]).map((status) => ({
  value: status,
  label: SERVICE_ZONE_STATUS_CHIP[status].label,
}));

/** Right side of A-06c: one zone's PIN codes, optional boundary and status. Mount with key={zone.id}. */
export function ServiceZoneDetail({ zone }: { zone: ServiceZone }) {
  const [status, setStatus] = useState(zone.status);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <Card variant="brand" className="flex-col items-start gap-4 px-5 py-4 sm:flex-row sm:items-center">
        <IconTile icon={Map} tone="glass" size="illusSm" className="hidden sm:grid" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-h3">{zone.name}</b>
          <span className="text-sm text-white/90">
            Resolved by PIN code (no boundary uploaded) · re-checked on every new request
          </span>
        </div>
        <Pill>{SERVICE_ZONE_STATUS_CHIP[zone.status].label}</Pill>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle icon={Mailbox}>PIN codes · {zone.pinCodes.length}</CardTitle>
          <RequirePermission permission="service_zone.manage">
            <Button variant="secondary" size="sm">
              Edit full PIN list
            </Button>
          </RequirePermission>
        </div>
        <ul className="flex flex-wrap gap-2">
          {zone.pinCodes.map((pinCode) => (
            <li key={pinCode} className="bg-muted rounded-sm px-2 py-[3px] font-mono text-xs font-medium">
              {pinCode}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle icon={Compass}>Boundary (optional)</CardTitle>
          <RequirePermission permission="service_zone.manage">
            <Button variant="secondary" size="sm">
              Upload GeoJSON
            </Button>
          </RequirePermission>
        </div>
        <p className="text-fg-muted text-sm">
          MultiPolygon, validated server-side. Once any zone has a boundary, polygons win over PIN codes.
        </p>
      </Card>

      <Card>
        <CardTitle icon={RefreshCw}>Status</CardTitle>
        <SegmentedControl
          label="Zone status"
          options={ZONE_STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />
        <AlertBanner tone="info" icon={Megaphone}>
          Setting a zone to <b>ACTIVE</b> notifies everyone on its waitlist (&quot;We&apos;re now in your
          area&quot;) — push / inbox, or email for logged-out sign-ups.
        </AlertBanner>
      </Card>
    </div>
  );
}

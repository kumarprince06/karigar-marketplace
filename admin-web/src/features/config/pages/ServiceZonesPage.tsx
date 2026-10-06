import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, DataTable, StatusChip, type Column } from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { CardTitle } from '../components/CardTitle';
import { ServiceZoneDetail } from '../components/ServiceZoneDetail';
import { SERVICE_ZONES, WAITLIST_DEMAND } from '../operations-mock-data';
import { SERVICE_ZONE_STATUS_CHIP } from '../status-chip-styles';
import type { ServiceZone, WaitlistDemand } from '../types';

const waitlistColumns: Column<WaitlistDemand>[] = [
  { id: 'pin', header: 'PIN', cell: (demand) => <span className="font-mono">{demand.pinCode}</span> },
  {
    id: 'zone',
    header: 'In zone',
    cell: (demand) => demand.zoneName ?? <span className="text-fg-subtle">no zone</span>,
  },
  {
    id: 'waiting',
    header: 'Waiting',
    // The list is sorted by demand; the top PIN is emphasised.
    cell: (demand) => (demand === WAITLIST_DEMAND[0] ? <b>{demand.waitingCount}</b> : demand.waitingCount),
  },
];

/** A-06c service zones: list + waitlist demand on the left, the selected zone on the right. */
export function ServiceZonesPage() {
  const [selectedZoneId, setSelectedZoneId] = useState(SERVICE_ZONES[0]!.id);
  const selectedZone = SERVICE_ZONES.find((zone) => zone.id === selectedZoneId) ?? SERVICE_ZONES[0]!;

  const zoneColumns: Column<ServiceZone>[] = [
    {
      id: 'zone',
      header: 'Zone',
      cell: (zone) => (
        <button
          type="button"
          aria-current={zone.id === selectedZone.id ? 'true' : undefined}
          onClick={() => setSelectedZoneId(zone.id)}
          className="hover:text-primary cursor-pointer text-left font-bold"
        >
          {zone.name}
        </button>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (zone) => (
        <StatusChip tone={SERVICE_ZONE_STATUS_CHIP[zone.status].tone}>
          {SERVICE_ZONE_STATUS_CHIP[zone.status].label}
        </StatusChip>
      ),
    },
    { id: 'pins', header: 'PINs', cell: (zone) => zone.pinCodes.length },
    {
      id: 'waitlist',
      header: 'Waitlist',
      cell: (zone) => (zone.waitlistCount > 0 ? <b>{zone.waitlistCount}</b> : '—'),
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <RequirePermission permission="service_zone.manage">
          <Button size="sm">+ New zone</Button>
        </RequirePermission>
      </div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-col gap-3 xl:w-[420px] xl:shrink-0">
          <DataTable
            caption="Service zones"
            columns={zoneColumns}
            rows={SERVICE_ZONES}
            rowKey={(zone) => zone.id}
            rowClassName={(zone) => (zone.id === selectedZone.id ? 'bg-primary-subtle' : undefined)}
          />
          <Card>
            <CardTitle icon={Inbox}>Waitlist demand by PIN</CardTitle>
            <DataTable
              dense
              caption="Waitlist demand by PIN"
              columns={waitlistColumns}
              rows={WAITLIST_DEMAND}
              rowKey={(demand) => demand.pinCode}
            />
          </Card>
        </div>
        <ServiceZoneDetail key={selectedZone.id} zone={selectedZone} />
      </div>
    </>
  );
}

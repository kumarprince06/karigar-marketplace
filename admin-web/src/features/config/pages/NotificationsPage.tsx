import { Fingerprint, Inbox, Lock, Mail, Smartphone, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { AlertBanner, Button, DataTable, Input, Select, StatusChip, type Column } from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { formatClockTime, formatDateTime } from '@/lib/formatters';
import { NOTIFICATION_DELIVERIES } from '../operations-mock-data';
import { NOTIFICATION_STATUS_CHIP } from '../status-chip-styles';
import type { NotificationChannel, NotificationDelivery, NotificationStatus } from '../types';

const CHANNEL_ICONS: Record<NotificationChannel, LucideIcon> = {
  PUSH: Smartphone,
  IN_APP: Inbox,
  EMAIL: Mail,
};

const notificationColumns: Column<NotificationDelivery>[] = [
  { id: 'when', header: 'When', cell: (delivery) => formatDateTime(delivery.createdAt) },
  {
    id: 'type',
    header: 'Type',
    cell: (delivery) => <span className="font-mono text-[13px]">{delivery.type}</span>,
  },
  { id: 'category', header: 'Category', cell: (delivery) => delivery.category },
  {
    id: 'channel',
    header: 'Channel',
    cell: (delivery) => {
      const ChannelIcon = CHANNEL_ICONS[delivery.channel];
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <ChannelIcon aria-hidden className="size-4" /> {delivery.channel}
        </span>
      );
    },
  },
  { id: 'locale', header: 'Locale', cell: (delivery) => delivery.locale },
  {
    id: 'status',
    header: 'Status',
    cell: (delivery) => (
      <StatusChip tone={NOTIFICATION_STATUS_CHIP[delivery.status].tone}>
        {NOTIFICATION_STATUS_CHIP[delivery.status].label}
      </StatusChip>
    ),
  },
  { id: 'attempts', header: 'Attempts', cell: (delivery) => delivery.attempts ?? '—' },
  {
    id: 'failure',
    header: 'Failure',
    cell: (delivery) =>
      delivery.failureCode ? (
        <span className="font-mono text-[13px]">{delivery.failureCode}</span>
      ) : delivery.nextAttemptAt ? (
        `next try ${formatClockTime(delivery.nextAttemptAt)}`
      ) : (
        '—'
      ),
  },
  {
    id: 'provider',
    header: 'Provider id',
    cell: (delivery) =>
      delivery.providerMessageId ? (
        <span className="font-mono text-[13px]">{delivery.providerMessageId}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
  },
  {
    id: 'retry',
    header: <span className="sr-only">Actions</span>,
    cell: (delivery) =>
      delivery.status === 'FAILED' && (
        <RequirePermission permission="notification.retry">
          <Button size="sm">
            Retry<span className="sr-only"> {delivery.type}</span>
          </Button>
        </RequirePermission>
      ),
  },
];

/** A-06d delivery log (LLD-013). Read-only except retry of FAILED deliveries. */
export function NotificationsPage() {
  const [userIdFilter, setUserIdFilter] = useState('…4f21e9');
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'ANY'>('FAILED');
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | 'ANY'>('ANY');
  const [dateRangeFilter, setDateRangeFilter] = useState('LAST_7_DAYS');

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          leading={<Fingerprint aria-hidden className="size-4" />}
          aria-label="User id"
          className="w-full sm:w-[280px]"
          value={userIdFilter}
          onChange={(event) => setUserIdFilter(event.target.value)}
        />
        <Select
          aria-label="Status"
          className="w-full sm:w-[170px]"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as NotificationStatus | 'ANY')}
        >
          <option value="ANY">Status: any</option>
          {(Object.keys(NOTIFICATION_STATUS_CHIP) as NotificationStatus[]).map((status) => (
            <option key={status} value={status}>
              Status: {NOTIFICATION_STATUS_CHIP[status].label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Channel"
          className="w-full sm:w-40"
          value={channelFilter}
          onChange={(event) => setChannelFilter(event.target.value as NotificationChannel | 'ANY')}
        >
          <option value="ANY">Channel: any</option>
          {(Object.keys(CHANNEL_ICONS) as NotificationChannel[]).map((channel) => (
            <option key={channel} value={channel}>
              Channel: {channel}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Date range"
          className="w-full sm:w-[150px]"
          value={dateRangeFilter}
          onChange={(event) => setDateRangeFilter(event.target.value)}
        >
          <option value="TODAY">Today</option>
          <option value="LAST_7_DAYS">Last 7 days</option>
          <option value="LAST_30_DAYS">Last 30 days</option>
        </Select>
        <span className="hidden flex-1 xl:block" />
        <StatusChip className="whitespace-normal">
          Read-only log · push, email, in-app · no SMS · no campaigns
        </StatusChip>
      </div>

      <DataTable
        caption="Notification deliveries"
        columns={notificationColumns}
        rows={NOTIFICATION_DELIVERIES}
        rowKey={(delivery) => delivery.id}
      />

      <AlertBanner tone="neutral" icon={Lock}>
        Message titles, bodies and links are never shown here (they can hold personal details). Templates live
        in code — preview them in the repo, not in this console.
      </AlertBanner>
    </>
  );
}

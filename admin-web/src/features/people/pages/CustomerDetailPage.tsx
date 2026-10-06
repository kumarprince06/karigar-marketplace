import { Ban, Eye, IdCard, Mail, MapPin, Scale, Smartphone, User } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import {
  ArrowLink,
  Button,
  Card,
  CardHeader,
  CopyId,
  DataTable,
  Masked,
  Pill,
  StatusChip,
  Tabs,
  type Column,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { formatDateTime } from '@/lib/formatters';
import { DEMO_IDS } from '@/mocks/demo-ids';
import { AccountRestrictionDialog } from '../components/AccountRestrictionDialog';
import { ProfileHeaderButton } from '../components/ProfileHeaderButton';
import { ProfileHeaderCard } from '../components/ProfileHeaderCard';
import { RevealContactDialog } from '../components/RevealContactDialog';
import { SuspendCustomerDialog } from '../components/SuspendCustomerDialog';
import { findCustomerById, maskEmail, maskPhone } from '../mock-data';
import { getStatusTone } from '../status-tones';
import type { AuditEventSummary, CustomerBookingSummary, RevealableField } from '../types';

type CustomerTab = 'bookings' | 'requests' | 'addresses' | 'audit';

const REVEALED_FIELD_NAMES: Record<RevealableField, string> = {
  PHONE: 'Phone',
  EMAIL: 'Email',
  ADDRESSES: 'Addresses',
};

const BOOKING_COLUMNS: Column<CustomerBookingSummary>[] = [
  { id: 'id', header: 'Booking', cell: (booking) => <CopyId id={booking.id} /> },
  {
    id: 'problem',
    header: 'Trade · problem',
    cell: (booking) => (
      <>
        <booking.tradeIcon aria-hidden className="inline size-4 align-text-bottom" /> {booking.problem}
      </>
    ),
  },
  { id: 'worker', header: 'Worker', cell: (booking) => booking.workerName },
  { id: 'firstVisit', header: 'First visit', cell: (booking) => formatDateTime(booking.firstVisitAt) },
  {
    id: 'bookingStatus',
    header: 'Booking',
    cell: (booking) => (
      <StatusChip tone={getStatusTone(booking.bookingStatus)}>{booking.bookingStatus}</StatusChip>
    ),
  },
  {
    id: 'jobStatus',
    header: 'Job',
    cell: (booking) => <StatusChip tone={getStatusTone(booking.jobStatus)}>{booking.jobStatus}</StatusChip>,
  },
  {
    id: 'visitStatus',
    header: 'Next / last visit',
    cell: (booking) => (
      <StatusChip tone={getStatusTone(booking.visitStatus)}>{booking.visitStatus}</StatusChip>
    ),
  },
  {
    id: 'open',
    header: <span className="sr-only">Open</span>,
    // Static design: every booking links to the demo booking record.
    cell: () => <ArrowLink to={paths.booking(DEMO_IDS.booking)}>Open</ArrowLink>,
  },
];

const AUDIT_COLUMNS: Column<AuditEventSummary>[] = [
  { id: 'when', header: 'When', cell: (event) => formatDateTime(event.occurredAt) },
  { id: 'who', header: 'Who', cell: (event) => event.actorName },
  { id: 'action', header: 'Action', cell: (event) => <span className="font-mono">{event.action}</span> },
  { id: 'reason', header: 'Reason', cell: (event) => event.reasonCode ?? '—' },
];

/** A-02b: masked customer detail with reveal, restriction and suspend actions. */
export function CustomerDetailPage() {
  const { id } = useParams();
  const customer = findCustomerById(id);
  const revealDialog = useUrlDialog('reveal');
  const suspendDialog = useUrlDialog('suspend');
  const restrictDialog = useUrlDialog('restrict');
  const [activeTab, setActiveTab] = useState<CustomerTab>('bookings');
  // Revealed values live only in page memory and re-mask when the page unmounts (A-02c).
  const [revealedFields, setRevealedFields] = useState<RevealableField[]>([]);

  const handleReveal = (fields: RevealableField[]) =>
    setRevealedFields((current) => [...new Set([...current, ...fields])]);

  const isPhoneRevealed = revealedFields.includes('PHONE');
  const isEmailRevealed = revealedFields.includes('EMAIL');
  const areAddressesRevealed = revealedFields.includes('ADDRESSES');

  const auditTable = (
    <DataTable
      dense
      caption="Recent audit events"
      columns={AUDIT_COLUMNS}
      rows={customer.recentAuditEvents}
      rowKey={(event) => event.id}
      className="border-0"
    />
  );

  const addressList = (
    <ul className="flex flex-col gap-1.5 text-[13px]">
      {customer.addresses.map((address) => (
        <li key={address.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span>
            <address.icon aria-hidden className="inline size-4 align-text-bottom" /> {address.label} ·{' '}
            {areAddressesRevealed ? address.fullAddress : address.locality}
          </span>
          {!areAddressesRevealed && <span className="font-mono">{address.pinCode}</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <ProfileHeaderCard
        initials={customer.initials}
        name={customer.name}
        badges={
          <>
            <StatusChip tone={getStatusTone(customer.accountStatus)}>{customer.accountStatus}</StatusChip>
            <Pill icon={User}>Customer</Pill>
            {revealedFields.length > 0 && (
              <Pill icon={Eye}>
                {revealedFields.map((field) => REVEALED_FIELD_NAMES[field]).join(' + ')} revealed · re-masks
                when you leave this page
              </Pill>
            )}
          </>
        }
        details={
          <>
            <span className="flex items-center gap-1">
              <IdCard aria-hidden className="inline size-4 align-text-bottom" />
              <CopyId id={customer.id} className="text-white/85 hover:text-white" />
            </span>
            <Masked className="text-white/85">
              <Smartphone aria-hidden className="inline size-4 align-text-bottom" />{' '}
              {isPhoneRevealed ? customer.phone : maskPhone(customer.phone)}
            </Masked>
            <Masked className="text-white/85">
              <Mail aria-hidden className="inline size-4 align-text-bottom" />{' '}
              {isEmailRevealed ? customer.email : maskEmail(customer.email)}
            </Masked>
            <span className="text-white/85">
              Joined {customer.joinedOn} · {customer.language} · {customer.platform}
            </span>
          </>
        }
        actions={
          <>
            <RequirePermission permission="user.pii.reveal">
              <ProfileHeaderButton onClick={() => revealDialog.openDialog()}>
                <Eye aria-hidden className="inline size-4 align-text-bottom" /> Reveal contact…
              </ProfileHeaderButton>
            </RequirePermission>
            <RequirePermission permission="account.restrict">
              <Button variant="accent" onClick={() => restrictDialog.openDialog()}>
                <Ban aria-hidden className="inline size-4 align-text-bottom" /> Add restriction
              </Button>
            </RequirePermission>
            <RequirePermission permission="account.suspend">
              <Button variant="danger" onClick={() => suspendDialog.openDialog()}>
                Suspend
              </Button>
            </RequirePermission>
          </>
        }
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Tabs
            label="Customer records"
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { id: 'bookings', label: 'Bookings', count: customer.bookings.length },
              { id: 'requests', label: 'Requests', count: customer.requestCount },
              { id: 'addresses', label: 'Addresses', count: customer.addresses.length },
              { id: 'audit', label: 'Audit', count: customer.auditEventCount },
            ]}
          />

          {activeTab === 'bookings' && (
            <DataTable
              caption="Customer bookings"
              columns={BOOKING_COLUMNS}
              rows={customer.bookings}
              rowKey={(booking) => booking.id}
            />
          )}
          {activeTab === 'requests' && (
            <Card>
              <p className="text-fg-muted">
                {customer.requestCount} requests from this customer.{' '}
                <ArrowLink to={paths.requests}>Open in Requests</ArrowLink>
              </p>
            </Card>
          )}
          {activeTab === 'addresses' && <Card>{addressList}</Card>}
          {activeTab === 'audit' && <Card padding="none">{auditTable}</Card>}

          <Card className="gap-1.5">
            <CardHeader
              className="flex-wrap"
              title="Recent activity (audit)"
              aside={<ArrowLink to={paths.audit}>Audit log</ArrowLink>}
            />
            {auditTable}
          </Card>
        </div>

        <aside className="flex w-full flex-col gap-3 xl:w-[360px] xl:shrink-0" aria-label="Customer summary">
          <Card>
            <CardHeader
              className="flex-wrap"
              title={
                <>
                  <Ban aria-hidden className="inline size-4 align-text-bottom" /> Restrictions
                </>
              }
              aside={
                customer.liveRestrictionCount === 0 ? (
                  <StatusChip tone="success">None live</StatusChip>
                ) : (
                  <StatusChip tone="error">{customer.liveRestrictionCount} live</StatusChip>
                )
              }
            />
            {customer.lastLiftedRestriction && (
              <p className="text-fg-muted text-[13px]">Last lifted: {customer.lastLiftedRestriction}.</p>
            )}
          </Card>

          {customer.openDispute && (
            <Card className="border-l-warning border-l-4">
              <CardHeader
                className="flex-wrap"
                title={
                  <>
                    <Scale aria-hidden className="inline size-4 align-text-bottom" /> Open dispute
                  </>
                }
                aside={
                  <StatusChip tone={getStatusTone(customer.openDispute.status)}>
                    {customer.openDispute.status}
                  </StatusChip>
                }
              />
              <p className="flex flex-wrap items-center gap-1 text-[13px]">
                <CopyId id={customer.openDispute.id} /> · {customer.openDispute.reasonCode} ·{' '}
                {customer.openDispute.scope} of booking <CopyId id={customer.openDispute.bookingId} />
              </p>
              <ArrowLink to={paths.dispute(DEMO_IDS.dispute)}>Open case</ArrowLink>
            </Card>
          )}

          <Card>
            <h3 className="text-h4 font-semibold">
              <MapPin aria-hidden className="inline size-4 align-text-bottom" /> Addresses
            </h3>
            {addressList}
            <p className="text-fg-muted text-[13px] leading-[18px]">
              Locality + PIN only. Full address via Reveal.
            </p>
          </Card>

          <Card>
            <h3 className="text-h4 font-semibold">Counts</h3>
            <p className="flex flex-wrap justify-between gap-x-3 text-[13px]">
              <span>
                Requests {customer.requestCount} · Bookings {customer.bookings.length}
              </span>
              <span>Reviews written {customer.reviewsWrittenCount}</span>
            </p>
          </Card>
        </aside>
      </div>

      <RevealContactDialog
        open={revealDialog.isOpen}
        onClose={revealDialog.closeDialog}
        availableFields={['PHONE', 'EMAIL', 'ADDRESSES']}
        onReveal={handleReveal}
      />
      <SuspendCustomerDialog
        open={suspendDialog.isOpen}
        onClose={suspendDialog.closeDialog}
        customer={customer}
      />
      <AccountRestrictionDialog
        open={restrictDialog.isOpen}
        onClose={restrictDialog.closeDialog}
        accountType="CUSTOMER"
      />
    </>
  );
}

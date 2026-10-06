import {
  Ban,
  CalendarClock,
  CalendarDays,
  Check,
  CircleDot,
  Eye,
  IdCard,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  Smartphone,
  Star,
  TriangleAlert,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import {
  ArrowLink,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  CopyId,
  DataTable,
  Masked,
  Pill,
  StatusChip,
  type Column,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { RequirePermission } from '@/features/auth';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { formatDateTime, formatMoney } from '@/lib/formatters';
import { mergeClassNames } from '@/lib/merge-class-names';
import { AccountRestrictionDialog } from '../components/AccountRestrictionDialog';
import { ProfileHeaderButton } from '../components/ProfileHeaderButton';
import { ProfileHeaderCard } from '../components/ProfileHeaderCard';
import { RevealContactDialog } from '../components/RevealContactDialog';
import { SuspendWorkerDialog } from '../components/SuspendWorkerDialog';
import { findWorkerById, maskEmail, maskPhone } from '../mock-data';
import { getStatusTone } from '../status-tones';
import type { RevealableField, WorkerStrike, WorkerTrade } from '../types';

const TRADE_COLUMNS: Column<WorkerTrade>[] = [
  {
    id: 'trade',
    header: 'Trade',
    cell: (trade) => (
      <>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <trade.icon aria-hidden className="size-4 shrink-0" /> {trade.name}
        </span>
        <small className="text-fg-subtle block whitespace-nowrap">
          {trade.experienceYears} yrs experience
        </small>
      </>
    ),
  },
  {
    id: 'rate',
    header: 'Rate',
    cell: (trade) => (
      <span className="font-semibold whitespace-nowrap tabular-nums">
        {formatMoney(trade.ratePaise)} / {trade.rateUnit}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (trade) => <StatusChip tone={getStatusTone(trade.status)}>{trade.status}</StatusChip>,
  },
  {
    id: 'eligible',
    header: 'Job eligible',
    cell: (trade) =>
      trade.isJobEligible ? (
        <StatusChip tone="success">
          <Check aria-hidden className="size-3.5" /> Yes
        </StatusChip>
      ) : (
        <StatusChip tone="error">
          <X aria-hidden className="size-3.5" /> Not yet
        </StatusChip>
      ),
  },
];

const STRIKE_COLUMNS: Column<WorkerStrike>[] = [
  {
    id: 'type',
    header: 'Type',
    cell: (strike) => (
      <>
        {strike.type}
        <small className="text-fg-subtle block">
          {strike.issuedOn} · {strike.source}
        </small>
      </>
    ),
  },
  { id: 'points', header: 'Pts', cell: (strike) => strike.points },
  {
    id: 'status',
    header: 'Status',
    cell: (strike) => (
      <StatusChip tone={strike.status === 'ACTIVE' ? 'warning' : 'neutral'}>{strike.status}</StatusChip>
    ),
  },
];

const SYSTEM_OWNED_RESTRICTION_SOURCES = ['STRIKES', 'DUES'];

/** A-02e: masked worker detail with trades, checks, strikes, restrictions, money and confirmed bookings. */
export function WorkerDetailPage() {
  const { id } = useParams();
  const worker = findWorkerById(id);
  const revealDialog = useUrlDialog('reveal');
  const suspendDialog = useUrlDialog('suspend');
  const restrictDialog = useUrlDialog('restrict');
  // Revealed values live only in page memory and re-mask when the page unmounts.
  const [revealedFields, setRevealedFields] = useState<RevealableField[]>([]);

  const handleReveal = (fields: RevealableField[]) =>
    setRevealedFields((current) => [...new Set([...current, ...fields])]);

  const activeStrikePoints = worker.strikes
    .filter((strike) => strike.status === 'ACTIVE')
    .reduce((total, strike) => total + strike.points, 0);
  const owesMoney = worker.ledgerBalancePaise < 0;

  return (
    <>
      <ProfileHeaderCard
        initials={worker.initials}
        name={worker.name}
        badges={
          <>
            <StatusChip tone={getStatusTone(worker.accountStatus)}>{worker.accountStatus}</StatusChip>
            <StatusChip tone={worker.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>
              <ShieldCheck aria-hidden className="inline size-4 align-text-bottom" />{' '}
              {worker.verificationStatus}
              {worker.pendingVerificationCount > 0 && ` · ${worker.pendingVerificationCount} pending`}
            </StatusChip>
            <Pill icon={CircleDot}>{worker.availability}</Pill>
          </>
        }
        details={
          <>
            <span className="flex items-center gap-1 text-white/85">
              <IdCard aria-hidden className="inline size-4 align-text-bottom" /> worker
              <CopyId id={worker.id} className="text-white/85 hover:text-white" />
            </span>
            <Masked className="text-white/85">
              <Smartphone aria-hidden className="inline size-4 align-text-bottom" />{' '}
              {revealedFields.includes('PHONE') ? worker.phone : maskPhone(worker.phone)}
            </Masked>
            <Masked className="text-white/85">
              <Mail aria-hidden className="inline size-4 align-text-bottom" />{' '}
              {revealedFields.includes('EMAIL') ? worker.email : maskEmail(worker.email)}
            </Masked>
            <span className="text-white/85">
              <Star aria-hidden className="inline size-4 align-text-bottom" /> {worker.rating} ·{' '}
              {worker.reviewCount} reviews · {worker.language}
            </span>
          </>
        }
        actions={
          <>
            <RequirePermission permission="user.pii.reveal">
              <ProfileHeaderButton onClick={() => revealDialog.openDialog()}>
                <Eye aria-hidden className="inline size-4 align-text-bottom" /> Reveal…
              </ProfileHeaderButton>
            </RequirePermission>
            {/* No schedule screen is designed yet; the bookings list is the closest view. */}
            <ButtonLink
              to={paths.bookings}
              variant="ghost"
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <CalendarClock aria-hidden className="inline size-4 align-text-bottom" /> Schedule
            </ButtonLink>
            <RequirePermission permission="account.restrict">
              <Button variant="accent" onClick={() => restrictDialog.openDialog()}>
                <Ban aria-hidden className="inline size-4 align-text-bottom" /> Restriction
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

      <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <Card>
            <CardHeader
              className="flex-wrap"
              title={
                <>
                  <Wrench aria-hidden className="inline size-4 align-text-bottom" /> Trades
                </>
              }
              aside={
                <span className="text-fg-muted text-[13px]">
                  <MapPin aria-hidden className="inline size-4 align-text-bottom" /> Base:{' '}
                  {worker.baseLocality} · radius {worker.radiusKm} km
                </span>
              }
            />
            <DataTable
              dense
              caption="Trades"
              columns={TRADE_COLUMNS}
              rows={worker.trades}
              rowKey={(trade) => trade.name}
            />
          </Card>

          <Card>
            <CardHeader
              className="flex-wrap"
              title={
                <>
                  <ShieldCheck aria-hidden className="inline size-4 align-text-bottom" /> Verification checks
                </>
              }
              aside={<ArrowLink to={paths.verifications}>Open queue</ArrowLink>}
            />
            <ul className="flex flex-col gap-2 text-[13px]">
              {worker.verificationChecks.map((check) => (
                <li key={check.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span>
                    {check.name}{' '}
                    {check.optionalNote && <span className="text-fg-subtle">{check.optionalNote}</span>}
                  </span>
                  <StatusChip tone={getStatusTone(check.status)}>
                    {check.status === 'NOT_SUBMITTED' ? 'Not submitted' : check.status}
                    {check.statusDetail && ` · ${check.statusDetail}`}
                  </StatusChip>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <Card>
            <CardHeader
              className="flex-wrap"
              title={
                <>
                  <TriangleAlert aria-hidden className="inline size-4 align-text-bottom" /> Strikes
                </>
              }
              aside={<StatusChip tone="warning">{activeStrikePoints} active pts</StatusChip>}
            />
            <DataTable
              dense
              caption="Strikes"
              columns={STRIKE_COLUMNS}
              rows={worker.strikes}
              rowKey={(strike) => `${strike.type}-${strike.issuedOn}`}
            />
            <p className="text-fg-muted text-[13px] leading-[18px]">
              Strikes are issued / revoked through dispute actions (WORKER_STRIKE / REVOKE_STRIKE).
            </p>
          </Card>

          <Card>
            <h3 className="text-h4 font-semibold">
              <Ban aria-hidden className="inline size-4 align-text-bottom" /> Restrictions
            </h3>
            {worker.restrictions.length === 0 ? (
              <StatusChip tone="success" className="self-start">
                None live
              </StatusChip>
            ) : (
              <ul className="flex flex-col gap-2 text-[13px]">
                {worker.restrictions.map((restriction) => (
                  <li
                    key={restriction.type}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                  >
                    <span>
                      {restriction.type} · <b>{restriction.source}</b>
                    </span>
                    {SYSTEM_OWNED_RESTRICTION_SOURCES.includes(restriction.source) && (
                      <StatusChip tone="neutral">
                        <Lock aria-hidden className="inline size-4 align-text-bottom" /> Not liftable here
                      </StatusChip>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {worker.restrictions.some((restriction) => restriction.source === 'STRIKES') && (
              <p className="text-fg-muted text-[13px] leading-[18px]">
                Lifts when strikes expire or are revoked.
              </p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <Card>
            <h3 className="text-h4 font-semibold">
              <Wallet aria-hidden className="inline size-4 align-text-bottom" /> Money
            </h3>
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <dt>Ledger balance</dt>
                <dd className={mergeClassNames('font-semibold tabular-nums', owesMoney && 'text-error')}>
                  {formatMoney(worker.ledgerBalancePaise)}
                  {owesMoney && ' (owes)'}
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <dt>Dues limit</dt>
                <dd className="tabular-nums">{formatMoney(worker.duesLimitPaise)}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <dt>Payout account</dt>
                <dd>
                  <StatusChip tone={getStatusTone(worker.payoutAccount.status)}>
                    {worker.payoutAccount.status} · …{worker.payoutAccount.lastFourDigits}
                  </StatusChip>
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <dt>Payout hold</dt>
                <dd>
                  <StatusChip tone={worker.payoutHold ? 'error' : 'neutral'}>
                    {worker.payoutHold ?? 'None'}
                  </StatusChip>
                </dd>
              </div>
            </dl>
            <ArrowLink to={paths.ledger}>Ledger &amp; payouts</ArrowLink>
          </Card>

          <Card>
            <CardHeader
              className="flex-wrap"
              title={
                <>
                  <CalendarDays aria-hidden className="inline size-4 align-text-bottom" /> Confirmed bookings
                </>
              }
              aside={<StatusChip tone="brand">{worker.confirmedBookings.length}</StatusChip>}
            />
            <ul className="flex flex-col gap-2 text-[13px]">
              {worker.confirmedBookings.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <CopyId id={booking.id} />
                  <span>
                    {formatDateTime(booking.startsAt)}
                    {booking.visitStatus && ` · ${booking.visitStatus}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <RevealContactDialog
        open={revealDialog.isOpen}
        onClose={revealDialog.closeDialog}
        availableFields={['PHONE', 'EMAIL']}
        onReveal={handleReveal}
      />
      <SuspendWorkerDialog open={suspendDialog.isOpen} onClose={suspendDialog.closeDialog} worker={worker} />
      <AccountRestrictionDialog
        open={restrictDialog.isOpen}
        onClose={restrictDialog.closeDialog}
        accountType="WORKER"
      />
    </>
  );
}

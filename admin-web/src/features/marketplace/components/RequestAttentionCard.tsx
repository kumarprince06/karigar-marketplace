import { Camera, Mic } from 'lucide-react';
import {
  AlertBanner,
  ButtonLink,
  Card,
  CopyId,
  KeyValueList,
  Masked,
  Money,
  SectionLabel,
  Timeline,
} from '@/components/ui';
import { paths } from '@/config/route-paths';
import { formatMoney } from '@/lib/formatters';
import { formatClockTime } from '@/lib/formatters';
import type { RequestDetail } from '../types';
import { MarketplaceStatusChip } from './MarketplaceStatusChip';

/** Side rail on the requests list: the open request that needs attention, with its matching rounds. */
export function RequestAttentionCard({ detail }: { detail: RequestDetail }) {
  const { request } = detail;
  const timelineItems = detail.rounds.map((round) => ({
    title: `Round ${round.round} · ${round.radiusKm} km`,
    meta: `${formatClockTime(round.startedAt)} · ${round.offeredCount} offered · ${
      round.interestedCount === null ? 'waiting' : `${round.interestedCount} interested`
    }`,
    state: round.interestedCount === null ? ('now' as const) : ('done' as const),
  }));

  return (
    <Card>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-h4 font-semibold">
          Request <CopyId id={request.id} />
        </h3>
        <MarketplaceStatusChip kind="request" status={request.status} />
      </header>
      <AlertBanner tone="warning">{detail.attentionMessage}</AlertBanner>
      <KeyValueList
        labelWidth="sm"
        className="grid-cols-[90px_1fr]"
        items={[
          {
            label: 'Customer',
            value: (
              <>
                {detail.customerName} · <Masked>{detail.customerPhoneMasked}</Masked>
              </>
            ),
          },
          { label: 'Window', value: detail.window },
          {
            label: 'Price guide',
            value: (
              <Money>
                {formatMoney(detail.priceGuide.min)} – {formatMoney(detail.priceGuide.max)}
              </Money>
            ),
          },
          { label: 'Advance', value: detail.advanceDescription },
          {
            label: 'Media',
            value: (
              <>
                <span className="inline-flex flex-wrap items-center gap-1">
                  <Camera aria-hidden className="size-3.5" /> {detail.media.photoCount} photos ·{' '}
                  <Mic aria-hidden className="size-3.5" /> {detail.media.voiceNoteCount} voice
                </span>
              </>
            ),
          },
        ]}
      />
      <SectionLabel className="mt-1">Matching rounds</SectionLabel>
      <Timeline items={timelineItems} />
      <ButtonLink to={paths.customer(detail.customerId)} variant="secondary" size="sm" block>
        Open customer
      </ButtonLink>
    </Card>
  );
}

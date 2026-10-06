import { Scale, Undo2 } from 'lucide-react';
import { AlertBanner, Card, CopyId, IconTile, StatusChip } from '@/components/ui';
import { DISPUTE_STATUS_CHIP } from '../status-chip-presentation';
import type { ResolvedDispute } from '../types';
import { ResolvedDisputeActions } from './ResolvedDisputeActions';

/** A-04f. Closed case: outcome header, then the status of each action it triggered. */
export function ResolvedDisputeOverview({ dispute }: { dispute: ResolvedDispute }) {
  const statusChip = DISPUTE_STATUS_CHIP[dispute.status];
  return (
    <>
      <Card
        variant="brand"
        className="flex-col items-start gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-[22px] sm:py-[18px]"
      >
        <IconTile icon={Scale} tone="glass" size="illusSm" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-h3">
              {dispute.category} · {dispute.subjectLabel}{' '}
              <CopyId id={dispute.subjectId} className="text-white/85 hover:text-white" />
            </b>
            <StatusChip tone={statusChip.tone}>{statusChip.label}</StatusChip>
          </div>
          <span className="text-[13px] text-white/90">
            {dispute.outcome} · at fault {dispute.atFault} · closed by {dispute.closedBy} {dispute.closedAt} ·
            subject settled at close; refunds and strikes run after
          </span>
        </div>
      </Card>
      <ResolvedDisputeActions dispute={dispute} />
      <AlertBanner tone="warning" icon={Undo2}>
        A failed action goes to the ops queue and <b>never reopens</b> the case. Retry reuses the same key so
        the refund happens once; Cancel needs a note.
      </AlertBanner>
    </>
  );
}

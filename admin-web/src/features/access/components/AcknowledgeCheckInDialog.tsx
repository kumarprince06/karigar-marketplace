import { useState } from 'react';
import {
  Button,
  CopyId,
  Field,
  ModalDialog,
  PermTag,
  RadioOrCheckbox,
  SectionLabel,
  Textarea,
} from '@/components/ui';
import { useUrlDialog } from '@/hooks/useUrlDialog';
import { formatDistance } from '../format-distance';
import type { AcknowledgeOutcome, FlaggedCheckIn } from '../types';

const NOTE_MAX_LENGTH = 500;

const OUTCOME_OPTIONS: readonly { value: AcknowledgeOutcome; label: string; description: string }[] = [
  {
    value: 'NO_ACTION',
    label: 'Looked at — no action needed',
    description: 'NO_ACTION · e.g. poor GPS, start code entered on time',
  },
  {
    value: 'HANDLED_ELSEWHERE',
    label: 'Handled elsewhere',
    description: 'HANDLED_ELSEWHERE · e.g. a dispute or a strike was opened',
  },
];

function describeStartCode(checkIn: FlaggedCheckIn): string {
  return checkIn.startCode.status === 'VERIFIED'
    ? `start code verified at ${checkIn.startCode.verifiedAt}`
    : 'start code not entered';
}

/**
 * POST /admin/ops/queues/FLAGGED_CHECK_IN/items/{itemId}/ack {outcome, note}. Opened with ?dialog=acknowledge&visit=<id>;
 * an unknown visit id falls back to the first item so the deep link always shows something.
 */
export function AcknowledgeCheckInDialog({ checkIns }: { checkIns: readonly FlaggedCheckIn[] }) {
  const { isOpen, closeDialog, params } = useUrlDialog('acknowledge');
  const [outcome, setOutcome] = useState<AcknowledgeOutcome>('NO_ACTION');
  const [note, setNote] = useState(
    'Start code at 10:14, customer confirmed visit. GPS drift in Shibpur lanes.',
  );

  const selectedVisitId = params.get('visit');
  const checkIn = checkIns.find((item) => item.visitId === selectedVisitId) ?? checkIns[0];
  if (!checkIn) return null;

  const handleAcknowledgeClick = () => closeDialog();

  return (
    <ModalDialog
      open={isOpen}
      onClose={closeDialog}
      title="Acknowledge flagged check-in"
      aside={<PermTag>ops.act</PermTag>}
      description={
        <>
          Visit <CopyId id={checkIn.visitId} /> · {checkIn.workerName} ·{' '}
          {formatDistance(checkIn.distanceMeters)} from address, {describeStartCode(checkIn)}.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button onClick={handleAcknowledgeClick}>Acknowledge</Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">
          <SectionLabel>Outcome</SectionLabel>
        </legend>
        {OUTCOME_OPTIONS.map((option) => (
          <RadioOrCheckbox
            key={option.value}
            name="acknowledge-outcome"
            value={option.value}
            checked={outcome === option.value}
            onChange={() => setOutcome(option.value)}
            label={option.label}
            description={option.description}
          />
        ))}
      </fieldset>
      <Field label="Note" hint={`(optional, max ${NOTE_MAX_LENGTH})`}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </Field>
      <p className="text-fg-muted text-[13px] leading-[18px]">
        Removes the item from the queue for everyone. Saved in the audit log with your name.
      </p>
    </ModalDialog>
  );
}

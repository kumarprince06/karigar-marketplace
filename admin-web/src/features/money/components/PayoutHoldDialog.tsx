import { Ban } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Field, ModalDialog, PermTag, Select, Textarea } from '@/components/ui';
import { PAYOUT_HOLD_REASON_CODES } from '../mock-data';

interface PayoutHoldDialogProps {
  workerName: string;
  onClose: () => void;
}

/** Adds a NO_PAYOUTS restriction (source ADMIN). Mounted only while open. */
export function PayoutHoldDialog({ workerName, onClose }: PayoutHoldDialogProps) {
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const canSubmit = reasonCode !== '' && note.trim() !== '';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onClose();
  };

  return (
    <ModalDialog
      open
      onClose={onClose}
      title={
        <>
          <span className="inline-flex items-center gap-2">
            <Ban aria-hidden className="size-5" /> Put payouts on hold
          </span>
        </>
      }
      aside={<PermTag>finance.payout</PermTag>}
      description={`${workerName}: earnings keep accruing but nothing is paid out until the hold is lifted.`}
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <Field label="Reason">
          {({ id }) => (
            <Select
              id={id}
              required
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            >
              <option value="">Select reason</option>
              {PAYOUT_HOLD_REASON_CODES.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Note" hint="(required)">
          {({ id }) => (
            <Textarea id={id} required value={note} onChange={(event) => setNote(event.target.value)} />
          )}
        </Field>
        <footer className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={!canSubmit}>
            Put on hold
          </Button>
        </footer>
      </form>
    </ModalDialog>
  );
}

import { Eye, Hourglass } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import {
  AlertBanner,
  Button,
  Field,
  ModalDialog,
  PermTag,
  SectionLabel,
  Select,
  SelectableOptionTile,
  Textarea,
} from '@/components/ui';
import { PII_REVEAL_REASONS, REVEALS_LEFT_THIS_HOUR, REVEALS_PER_HOUR_LIMIT } from '../mock-data';
import type { RevealableField } from '../types';

const FIELD_LABELS: Record<RevealableField, string> = {
  PHONE: 'Phone',
  EMAIL: 'Email',
  ADDRESSES: 'Full addresses',
};

interface RevealContactDialogProps {
  open: boolean;
  onClose: () => void;
  availableFields: readonly RevealableField[];
  onReveal: (fields: RevealableField[]) => void;
}

/** A-02c: reveal only the fields needed, with a reason; audited as USER_PII_REVEALED, 20 per hour. */
export function RevealContactDialog({ open, onClose, availableFields, onReveal }: RevealContactDialogProps) {
  const formId = useId();
  const [selectedFields, setSelectedFields] = useState<RevealableField[]>(['PHONE']);
  const [reasonCode, setReasonCode] = useState(PII_REVEAL_REASONS[0]?.code ?? '');
  const [note, setNote] = useState("Customer called about today's visit; calling back on registered number.");

  const handleFieldToggle = (field: RevealableField, isChecked: boolean) =>
    setSelectedFields((current) =>
      isChecked ? [...current, field] : current.filter((selectedField) => selectedField !== field),
    );

  const handleRevealSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onReveal(selectedFields);
    onClose();
  };

  const submitLabel = `Reveal ${selectedFields.map((field) => FIELD_LABELS[field].toLowerCase()).join(' + ')}`;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <>
          <Eye aria-hidden className="inline size-4 align-text-bottom" /> Reveal contact details
        </>
      }
      aside={<PermTag>user.pii.reveal</PermTag>}
      description="Only reveal what you need for this case. Every reveal is saved in the audit log with your name, the fields and your reason."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={selectedFields.length === 0}>
            {selectedFields.length === 0 ? 'Reveal' : submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleRevealSubmit} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2">
          <legend>
            <SectionLabel>Fields</SectionLabel>
          </legend>
          <div className="flex flex-wrap gap-2">
            {availableFields.map((field) => (
              <SelectableOptionTile
                key={field}
                type="checkbox"
                checked={selectedFields.includes(field)}
                onChange={(event) => handleFieldToggle(field, event.target.checked)}
              >
                {FIELD_LABELS[field]}
              </SelectableOptionTile>
            ))}
          </div>
        </fieldset>
        <Field label="Reason">
          {({ id }) => (
            <Select id={id} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
              {PII_REVEAL_REASONS.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Note" hint="(optional, required for some reasons · max 500)">
          {({ id }) => (
            <Textarea
              id={id}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
        <AlertBanner tone="warning" icon={Hourglass}>
          <b>
            {REVEALS_LEFT_THIS_HOUR} of {REVEALS_PER_HOUR_LIMIT}
          </b>{' '}
          reveals left this hour. More than 30 in a day alerts security.
        </AlertBanner>
      </form>
    </ModalDialog>
  );
}

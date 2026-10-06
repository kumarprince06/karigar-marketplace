import { Lock } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import {
  Button,
  Field,
  Input,
  ModalDialog,
  PermTag,
  SectionLabel,
  SegmentedControl,
  Select,
  SelectableOptionTile,
} from '@/components/ui';
import { ACCOUNT_RESTRICTION_REASONS, RESTRICTION_TYPE_OPTIONS } from '../mock-data';
import type { ProfileType, RestrictionSource, RestrictionType } from '../types';

/** Only these sources can be added by staff; STRIKES and DUES are set by the system. */
type StaffRestrictionSource = Extract<RestrictionSource, 'ADMIN' | 'FRAUD'>;

const SOURCE_OPTIONS: { value: StaffRestrictionSource; label: string }[] = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'FRAUD', label: 'FRAUD' },
];

interface AccountRestrictionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Restriction types that don't apply to this account type are shown disabled. */
  accountType: ProfileType;
}

/** A-02d (right): add an ADMIN or FRAUD restriction. STRIKES and DUES restrictions are system-owned. */
export function AccountRestrictionDialog({ open, onClose, accountType }: AccountRestrictionDialogProps) {
  const formId = useId();
  const applicableTypes = RESTRICTION_TYPE_OPTIONS.filter((option) => option.appliesTo === accountType);
  const [restrictionType, setRestrictionType] = useState<RestrictionType | undefined>(
    applicableTypes[0]?.type,
  );
  const [source, setSource] = useState<StaffRestrictionSource>('ADMIN');
  const [endsAt, setEndsAt] = useState('2026-10-12T23:59');
  const [reasonCode, setReasonCode] = useState(ACCOUNT_RESTRICTION_REASONS[0]?.code ?? '');
  const [note, setNote] = useState('2 worker reports, see dispute …d71e02');

  const handleAddRestrictionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Add restriction"
      aside={<PermTag>account.restrict</PermTag>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId}>
            Add restriction
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleAddRestrictionSubmit} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2">
          <legend>
            <SectionLabel>Type</SectionLabel>
          </legend>
          <div className="flex flex-wrap gap-2">
            {RESTRICTION_TYPE_OPTIONS.map((option) => {
              const isApplicable = option.appliesTo === accountType;
              return (
                <SelectableOptionTile
                  key={option.type}
                  type="radio"
                  name={`${formId}-type`}
                  value={option.type}
                  disabled={!isApplicable}
                  checked={restrictionType === option.type}
                  onChange={() => setRestrictionType(option.type)}
                >
                  {isApplicable && <option.icon aria-hidden className="inline size-4 align-text-bottom" />}
                  {option.type}
                  {!isApplicable && ` · ${option.appliesTo === 'WORKER' ? 'workers' : 'customers'}`}
                </SelectableOptionTile>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <SectionLabel>Source</SectionLabel>
          <SegmentedControl label="Source" options={SOURCE_OPTIONS} value={source} onChange={setSource} />
        </div>
        <Field label="Ends" hint="(optional — empty = until lifted)">
          {({ id }) => (
            <Input
              id={id}
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          )}
        </Field>
        <Field label="Reason">
          {({ id }) => (
            <Select id={id} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
              {ACCOUNT_RESTRICTION_REASONS.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Note">
          {({ id }) => <Input id={id} value={note} onChange={(event) => setNote(event.target.value)} />}
        </Field>
        <hr className="border-border" />
        <p className="text-[13px]">
          Lift a live restriction: reason + note. <b>STRIKES</b> and <b>DUES</b> sources can't be lifted here{' '}
          <Lock aria-hidden className="inline size-4 align-text-bottom" />
        </p>
      </form>
    </ModalDialog>
  );
}

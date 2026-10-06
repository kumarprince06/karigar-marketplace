import { Calculator } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  AlertBanner,
  Button,
  Field,
  Input,
  SectionLabel,
  SegmentedControl,
  Select,
  Textarea,
} from '@/components/ui';
import { formatMoney, type Paise } from '@/lib/formatters';
import { ADJUSTMENT_REASON_CODES } from '../mock-data';
import { formatSignedMoney, parseRupeesToPaise } from '../money-text';
import type { AdjustmentDirection } from '../types';

const DIRECTION_OPTIONS: readonly { value: AdjustmentDirection; label: string }[] = [
  { value: 'CREDIT', label: 'Credit worker' },
  { value: 'DEBIT', label: 'Debit worker' },
];

interface ManualAdjustmentFormProps {
  currentBalancePaise: Paise;
  duesLimitPaise: Paise;
  onCancel: () => void;
  onSubmitted: () => void;
}

/** A-05e: posts a balanced adjustment pair (P9). Previews the new WORKER_PAYABLE balance against the dues limit. */
export function ManualAdjustmentForm({
  currentBalancePaise,
  duesLimitPaise,
  onCancel,
  onSubmitted,
}: ManualAdjustmentFormProps) {
  const [direction, setDirection] = useState<AdjustmentDirection>('CREDIT');
  const [amountText, setAmountText] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');

  const amountPaise = parseRupeesToPaise(amountText);
  const validAmountPaise = amountPaise !== null && amountPaise > 0 ? amountPaise : null;
  const amountError =
    amountText !== '' && validAmountPaise === null
      ? 'Enter an amount in rupees, e.g. 236 or 99.50.'
      : undefined;
  const canSubmit = validAmountPaise !== null && reasonCode !== '' && note.trim() !== '';

  const newBalancePaise =
    validAmountPaise === null
      ? null
      : currentBalancePaise + (direction === 'CREDIT' ? validAmountPaise : -validAmountPaise);
  const wasOverDuesLimit = currentBalancePaise < -duesLimitPaise;
  const staysOverDuesLimit = newBalancePaise !== null && newBalancePaise < -duesLimitPaise;
  const duesLimitText = formatMoney(duesLimitPaise);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmitted();
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <SectionLabel>Direction</SectionLabel>
      <SegmentedControl
        label="Direction"
        options={DIRECTION_OPTIONS}
        value={direction}
        onChange={setDirection}
      />

      <Field label="Amount" error={amountError}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            leading="₹"
            inputMode="decimal"
            autoComplete="off"
            required
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            className="tabular-nums"
          />
        )}
      </Field>
      <Field label="Reason" help="Reason codes come from the server list.">
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            required
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
          >
            <option value="">Select reason</option>
            {ADJUSTMENT_REASON_CODES.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Note" hint="(required)">
        {({ id }) => (
          <Textarea
            id={id}
            required
            rows={2}
            className="min-h-16"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </Field>

      {newBalancePaise !== null && (
        <AlertBanner tone="info" icon={Calculator}>
          New balance <b>{formatSignedMoney(newBalancePaise)}</b> —{' '}
          {staysOverDuesLimit
            ? `still over the ${duesLimitText} dues limit; NO_NEW_OFFERS stays until it is within the limit.`
            : wasOverDuesLimit
              ? `back within the ${duesLimitText} dues limit; NO_NEW_OFFERS (DUES) is lifted.`
              : `within the ${duesLimitText} dues limit.`}
        </AlertBanner>
      )}

      <footer className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          Post adjustment
        </Button>
      </footer>
    </form>
  );
}

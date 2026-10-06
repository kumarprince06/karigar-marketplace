import { ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, PermTag, SectionLabel, Select } from '@/components/ui';
import { RequirePermission } from '@/features/auth';
import { PAYOUT_ACCOUNT_REJECT_REASON_CODES } from '../mock-data';
import type { PayoutAccount } from '../types';
import { NameMatchMeter } from './NameMatchMeter';

/** A-05d rail: compare the profile name with the penny-drop name, then approve or reject. */
export function PayoutAccountReviewCard({ account }: { account: PayoutAccount }) {
  const [rejectReason, setRejectReason] = useState('');

  return (
    <Card className="border-t-warning gap-3 border-t-4" aria-label="Review bank account">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-h4 font-semibold">Review bank account</h3>
        <PermTag>finance.payout</PermTag>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="bg-canvas min-w-0 rounded-md p-3 break-words">
          <SectionLabel>Worker name</SectionLabel>
          <b className="block">{account.workerName}</b>
          <span className="text-fg-muted text-[13px]">profile display name</span>
        </div>
        <div className="bg-canvas min-w-0 rounded-md p-3 break-words">
          <SectionLabel>Bank (penny-drop)</SectionLabel>
          <b className="block">{account.bankReturnedName}</b>
          <span className="text-fg-muted text-[13px]">
            penny-drop{' '}
            {account.pennyDropSucceeded ? (
              <>
                <Check aria-hidden className="inline size-3.5" /> succeeded
              </>
            ) : (
              'not done yet'
            )}
          </span>
        </div>
      </div>
      <NameMatchMeter score={account.nameMatchScore} />
      <p className="text-fg-muted text-[13px]">
        After approval: 24 h cooling-off before the first payout; worker gets email + push.
      </p>
      <RequirePermission
        permission="finance.payout"
        fallback={
          <p className="text-fg-muted text-[13px]">
            Approving or rejecting needs <PermTag>finance.payout</PermTag>.
          </p>
        }
      >
        <Button block disabled={account.status !== 'NEEDS_REVIEW'}>
          Approve <ArrowRight aria-hidden className="size-4" /> ACTIVE
        </Button>
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Reject reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            className="min-w-40 flex-1"
          >
            <option value="">Reject reason</option>
            {PAYOUT_ACCOUNT_REJECT_REASON_CODES.map((reasonCode) => (
              <option key={reasonCode}>{reasonCode}</option>
            ))}
          </Select>
          <Button variant="dangerOutline" disabled={rejectReason === ''}>
            Reject
          </Button>
        </div>
      </RequirePermission>
    </Card>
  );
}

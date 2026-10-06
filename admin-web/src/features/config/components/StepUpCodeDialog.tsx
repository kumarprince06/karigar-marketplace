import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, IconTile, ModalDialog, OtpCodeInput } from '@/components/ui';

interface StepUpCodeDialogProps {
  open: boolean;
  onClose: () => void;
  /** What the code unlocks, e.g. "revoke SUPPORT_AGENT". */
  actionLabel: string;
}

/** A-06g step-up: staff changes need an authenticator code from the last 15 minutes (403 MFA_REQUIRED). */
export function StepUpCodeDialog({ open, onClose, actionLabel }: StepUpCodeDialogProps) {
  const [code, setCode] = useState('720');

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Confirm it's you"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Verify &amp; {actionLabel}</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <IconTile icon={ShieldCheck} tone="brand" size="illusSm" />
        <p className="text-fg-muted text-sm">
          Changing staff access needs a code from the last 15 minutes. Your last code was 47 minutes ago.
        </p>
        <OtpCodeInput label="Authenticator code" value={code} onChange={setCode} />
      </div>
    </ModalDialog>
  );
}

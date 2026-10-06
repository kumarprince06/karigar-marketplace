import { useState } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Button, OtpCodeInput, StatusChip, Steps } from '@/components/ui';
import { FakeQrCode } from '../components/FakeQrCode';
import { useSignInNavigation } from '../useSignInNavigation';
import { SignInCard } from '../components/SignInCard';
import { MFA_ENROLMENT_SECRET } from '../mock-data';

/** A-01b MFA enrolment: POST /admin/me/mfa/enroll, then /admin/me/mfa/verify {code}. */
export function MfaSetupPage() {
  const { finishSignIn, logOut } = useSignInNavigation();
  const [code, setCode] = useState('4810');

  return (
    <SignInCard onSubmit={finishSignIn} className="max-w-[760px] gap-6 md:flex-row md:gap-8 md:p-9">
      <div className="flex shrink-0 flex-col items-center gap-3.5 md:w-[220px]">
        <FakeQrCode />
        <p className="text-fg-muted text-center text-[13px] leading-[18px]">
          Can&apos;t scan? Type this key:
        </p>
        <code className="bg-muted rounded-md px-3 py-2 font-mono text-sm tracking-[1px] whitespace-nowrap">
          {MFA_ENROLMENT_SECRET}
        </code>
        <StatusChip tone="warning">
          <TriangleAlert aria-hidden className="size-3.5" /> Shown only once
        </StatusChip>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <Steps total={3} current={2} label="Setup progress" />
        <h1 className="text-h2 font-semibold">Turn on 2-step login</h1>
        <p className="text-fg-muted">
          Every Karigar staff account needs an authenticator code. You can&apos;t open any admin page until
          this is done.
        </p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-[18px]">
          <li>Install an authenticator app on your phone.</li>
          <li>Scan the QR code (or type the key).</li>
          <li>Enter the 6-digit code it shows.</li>
        </ol>
        <div className="flex flex-col gap-1.5">
          <span aria-hidden className="text-sm font-semibold">
            6-digit code
          </span>
          <OtpCodeInput value={code} onChange={setCode} label="6-digit code" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">
            <CircleCheck aria-hidden className="size-4" /> Verify and turn on
          </Button>
          <Button variant="ghost" onClick={logOut}>
            Log out
          </Button>
        </div>
        <p className="text-fg-muted text-[13px] leading-[18px]">
          Lost your phone later? A Super Admin resets your 2-step login; you then set it up again here.
        </p>
      </div>
    </SignInCard>
  );
}

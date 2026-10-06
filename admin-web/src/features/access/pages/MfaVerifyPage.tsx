import { useState } from 'react';
import { LockKeyhole, Timer } from 'lucide-react';
import { AlertBanner, Button, IconTile, OtpCodeInput } from '@/components/ui';
import { useSession } from '@/features/auth';
import { useSignInNavigation } from '../useSignInNavigation';
import { SignInCard } from '../components/SignInCard';
import { MFA_TRIES_LEFT, REJECTED_MFA_CODE } from '../mock-data';

/** A-01c Enter authenticator code. Shown in the 422 MFA_CODE_INVALID state until the code is edited. */
export function MfaVerifyPage() {
  const { finishSignIn, logOut } = useSignInNavigation();
  const { session } = useSession();
  const [code, setCode] = useState(REJECTED_MFA_CODE);
  const isShowingRejectedCode = code === REJECTED_MFA_CODE;

  return (
    <SignInCard onSubmit={finishSignIn} className="items-center text-center">
      <IconTile icon={LockKeyhole} tone="brand" size="illusSm" />
      <h1 className="text-h2 font-semibold">Enter your 6-digit code</h1>
      <p className="text-fg-muted">
        Open your authenticator app and type the code for{' '}
        <b>
          Karigar Ops · <span className="break-all">{session.email}</span>
        </b>
        .
      </p>
      <OtpCodeInput
        value={code}
        onChange={setCode}
        invalid={isShowingRejectedCode}
        label="Authenticator code"
        className="justify-center"
      />
      {isShowingRejectedCode && (
        <p role="alert" className="text-error text-[13px] leading-[18px]">
          That code didn&apos;t work or was already used. {MFA_TRIES_LEFT} tries left before a 15-minute lock.
        </p>
      )}
      <Button type="submit" size="lg" block>
        Verify
      </Button>
      <AlertBanner tone="info" icon={Timer} className="text-left">
        One code keeps you signed in to the console for <b>12 hours</b> on this login. Managing staff asks
        again if your last code is older than 15 minutes.
      </AlertBanner>
      <Button variant="ghost" onClick={logOut}>
        Log out
      </Button>
    </SignInCard>
  );
}

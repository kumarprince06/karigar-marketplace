import { useEffect, useState } from 'react';
import { Lock, Smartphone } from 'lucide-react';
import { AlertBanner, Button, IconTile } from '@/components/ui';
import { useSignInNavigation } from '../useSignInNavigation';
import { SignInCard } from '../components/SignInCard';
import { MFA_LOCK_SECONDS_REMAINING } from '../mock-data';

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** A-01d 429 MFA_LOCKED: 5 wrong codes in 15 minutes, then a 15-minute lock. */
export function MfaLockedPage() {
  const { goToMfaStep, logOut } = useSignInNavigation();
  const [secondsRemaining, setSecondsRemaining] = useState(MFA_LOCK_SECONDS_REMAINING);
  const isLocked = secondsRemaining > 0;

  useEffect(() => {
    if (!isLocked) return;
    const intervalId = setInterval(() => setSecondsRemaining((seconds) => Math.max(seconds - 1, 0)), 1000);
    return () => clearInterval(intervalId);
  }, [isLocked]);

  return (
    <SignInCard onSubmit={goToMfaStep} className="items-center text-center">
      <IconTile icon={Lock} tone="danger" size="illusSm" />
      <h1 className="text-h2 font-semibold">2-step login locked</h1>
      <p className="text-fg-muted">
        5 wrong codes in 15 minutes. For safety, codes are blocked for a short time.
      </p>
      <div className="bg-error-subtle text-error flex w-full flex-col items-center gap-2 rounded-lg p-3.5">
        <span className="text-sm">Try again in</span>
        <b role="timer" className="font-mono text-[40px] leading-12 font-bold tabular-nums">
          {formatCountdown(secondsRemaining)}
        </b>
      </div>
      <AlertBanner tone="neutral" icon={Smartphone} className="text-left">
        Phone lost or app reset? Ask a Super Admin to reset your 2-step login. You&apos;ll set it up again
        with a new QR code.
      </AlertBanner>
      <div className="flex w-full gap-2">
        <Button variant="secondary" className="flex-1" onClick={logOut}>
          Log out
        </Button>
        <Button type="submit" disabled={isLocked} className="flex-1">
          Verify
        </Button>
      </div>
    </SignInCard>
  );
}

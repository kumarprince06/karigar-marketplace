import { useState } from 'react';
import { BriefcaseBusiness, Eye, EyeOff, LockKeyhole, ReceiptText, Wrench } from 'lucide-react';
import { AlertBanner, Button, Field, IconTile, Input, Pill } from '@/components/ui';
import { useSignInNavigation } from '../useSignInNavigation';
import { SignInCard } from '../components/SignInCard';

/** A-01a Staff login: email + password (LLD-001), then TOTP. No phone/OTP, no "remember this device". */
export function LoginPage() {
  const { goToMfaStep } = useSignInNavigation();
  const [email, setEmail] = useState('priya.sen@karigar.in');
  const [password, setPassword] = useState('karigar-demo-pass');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <>
      {/* Brand panel only from lg: on phones and tablets it would cover the form. */}
      <div className="bg-brand hidden shrink-0 flex-col gap-5 p-14 text-white lg:flex lg:w-[520px] xl:w-[620px]">
        <p className="flex items-center gap-2 text-[22px] font-bold">
          <Wrench aria-hidden className="size-6" /> Karigar Ops
        </p>
        <div className="flex-1" />
        <IconTile icon={BriefcaseBusiness} tone="glass" size="illus" className="self-center" />
        <p className="text-display font-bold">Operations console</p>
        <p className="text-[17px] leading-[26px] opacity-90">
          For Karigar staff: support, verification, disputes, finance and area operations in Howrah.
        </p>
        <div className="flex flex-wrap gap-2">
          <Pill icon={LockKeyhole}>Authenticator code on every login</Pill>
          <Pill icon={ReceiptText}>Every action audited</Pill>
          <Pill icon={EyeOff}>Customer data masked</Pill>
        </div>
        <div className="flex-1" />
        <p className="text-sm opacity-75">
          Staff accounts are created by a Super Admin. You set your own password from the invite email.
        </p>
      </div>

      <SignInCard onSubmit={goToMfaStep}>
        <p className="text-primary flex items-center gap-2 font-bold lg:hidden">
          <Wrench aria-hidden className="size-5" /> Karigar Ops
        </p>
        <div>
          <h1 className="text-h2 font-semibold">Log in</h1>
          <p className="text-fg-muted">Use your work email.</p>
        </div>
        <Field label="Email">
          {({ id }) => (
            <Input
              id={id}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <Field label="Password">
          {({ id }) => (
            <Input
              id={id}
              type={isPasswordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              trailing={
                <button
                  type="button"
                  aria-pressed={isPasswordVisible}
                  onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
                  className="text-primary inline-flex min-h-8 cursor-pointer items-center gap-1 text-[13px] font-semibold whitespace-nowrap"
                >
                  {isPasswordVisible ? (
                    <EyeOff aria-hidden className="size-4" />
                  ) : (
                    <Eye aria-hidden className="size-4" />
                  )}
                  {isPasswordVisible ? 'Hide' : 'Show'}
                  <span className="sr-only"> password</span>
                </button>
              }
            />
          )}
        </Field>
        {/* Generic on purpose: never reveal whether the account exists. */}
        <AlertBanner tone="error">Email or password is wrong. Check both and try again.</AlertBanner>
        <Button type="submit" size="lg" block>
          Log in
        </Button>
        <Button variant="ghost" block className="whitespace-normal">
          Forgot password? We&apos;ll email a reset link
        </Button>
        <hr className="border-border" />
        <p className="text-fg-muted text-[13px] leading-[18px]">
          Next step: a 6-digit code from your authenticator app (Google Authenticator, Microsoft
          Authenticator, Authy). We never send codes by SMS.
        </p>
      </SignInCard>
    </>
  );
}

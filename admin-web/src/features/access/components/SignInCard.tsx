import type { FormEvent, ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

interface SignInCardProps {
  onSubmit: () => void;
  className?: string;
  children: ReactNode;
}

/** The white card centred on the sign-in background (login and MFA screens). */
export function SignInCard({ onSubmit, className, children }: SignInCardProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="grid min-w-0 flex-1 place-items-center p-4 sm:p-6">
      <form
        onSubmit={handleSubmit}
        className={mergeClassNames(
          'bg-surface shadow-e2 flex w-full max-w-[440px] min-w-0 flex-col gap-4 rounded-xl p-5 sm:p-8',
          className,
        )}
      >
        {children}
      </form>
    </div>
  );
}

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** One-time code entry: auto-advance, backspace to previous box, paste fills all boxes. */
export function OtpCodeInput({
  value,
  onChange,
  length = 6,
  invalid,
  disabled,
  label = 'Code',
  className,
}: OtpCodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const setDigitAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, length));
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div role="group" aria-label={label} className={mergeClassNames('flex gap-1.5 sm:gap-2.5', className)}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`${label} digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          onPaste={handlePaste}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            setDigitAt(i, v);
            if (v && i < length - 1) refs.current[i + 1]?.focus();
          }}
          className={mergeClassNames(
            'bg-surface disabled:bg-muted h-12 w-10 rounded-md border-2 text-center font-mono text-2xl font-bold focus:outline-none sm:h-16 sm:w-14 sm:text-[28px]',
            invalid ? 'border-error' : d ? 'border-primary' : 'border-border-strong',
            'focus:border-primary focus:shadow-focus',
          )}
        />
      ))}
    </div>
  );
}

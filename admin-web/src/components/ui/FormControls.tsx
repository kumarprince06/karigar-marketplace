import { useId, type ComponentProps, type ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

const controlBase =
  'w-full rounded-md border-[1.5px] border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:shadow-focus focus:outline-none disabled:bg-muted disabled:text-fg-subtle aria-invalid:border-error';

interface FieldProps {
  label: ReactNode;
  /** Shown after the label in muted text, e.g. "(optional, max 500)". */
  hint?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  /** Render prop receives the ids to wire the control for a11y. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label + control + help/error, with ids wired for screen readers. */
export function Field({ label, hint, help, error, className, children }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const message = error ?? help;
  return (
    <div className={mergeClassNames('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label} {hint && <span className="text-fg-muted font-normal">{hint}</span>}
      </label>
      {children({ id, describedBy: message ? helpId : undefined, invalid: Boolean(error) })}
      {message && (
        <p
          id={helpId}
          className={mergeClassNames('text-[13px] leading-[18px]', error ? 'text-error' : 'text-fg-muted')}
        >
          {message}
        </p>
      )}
    </div>
  );
}

interface InputProps extends ComponentProps<'input'> {
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Input({ className, leading, trailing, ...props }: InputProps) {
  if (!leading && !trailing)
    return <input className={mergeClassNames(controlBase, 'min-h-10', className)} {...props} />;
  return (
    <div
      className={mergeClassNames(
        controlBase,
        'focus-within:border-primary focus-within:shadow-focus flex min-h-10 items-center gap-2',
        className,
      )}
    >
      {leading && (
        <span aria-hidden className="text-fg-subtle">
          {leading}
        </span>
      )}
      <input
        className="placeholder:text-fg-subtle min-w-0 flex-1 bg-transparent py-2 outline-none"
        {...props}
      />
      {trailing}
    </div>
  );
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea rows={rows} className={mergeClassNames(controlBase, 'min-h-24 py-2.5', className)} {...props} />
  );
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select className={mergeClassNames(controlBase, 'min-h-10 cursor-pointer pr-8', className)} {...props} />
  );
}

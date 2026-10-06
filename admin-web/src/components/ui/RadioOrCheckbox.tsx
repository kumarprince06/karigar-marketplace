import type { ComponentProps, ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

interface RadioOrCheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  type?: 'radio' | 'checkbox';
  label: ReactNode;
  description?: ReactNode;
}

/** Native radio / checkbox with a label and optional description. Keyboard and form behaviour come free. */
export function RadioOrCheckbox({
  type = 'radio',
  label,
  description,
  className,
  ...props
}: RadioOrCheckboxProps) {
  return (
    <label className={mergeClassNames('flex min-h-11 cursor-pointer items-start gap-2.5 text-sm', className)}>
      <input type={type} className="accent-primary mt-0.5 size-5 shrink-0 cursor-pointer" {...props} />
      <span>
        <span className="font-semibold">{label}</span>
        {description && <span className="text-fg-muted block">{description}</span>}
      </span>
    </label>
  );
}

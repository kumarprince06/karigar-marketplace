import { mergeClassNames } from '@/lib/merge-class-names';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={mergeClassNames('bg-muted flex gap-1 rounded-md p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={mergeClassNames(
            'text-fg-muted min-h-9 flex-1 cursor-pointer rounded-lg px-2.5 text-sm font-semibold',
            o.value === value && 'bg-surface text-primary shadow-e1',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

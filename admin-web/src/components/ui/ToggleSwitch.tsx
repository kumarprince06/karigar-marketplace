import { mergeClassNames } from '@/lib/merge-class-names';

interface ToggleSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
  /** Visually hide the label (it is still read by screen readers). */
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  hideLabel,
  size = 'md',
  disabled,
}: ToggleSwitchProps) {
  const sm = size === 'sm';
  return (
    <label
      className={mergeClassNames(
        'inline-flex items-center gap-2',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={hideLabel ? label : undefined}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={mergeClassNames(
          'relative shrink-0 rounded-full transition-colors disabled:opacity-60',
          sm ? 'h-5 w-[34px]' : 'h-7 w-12',
          checked ? 'bg-primary' : 'bg-border-strong',
        )}
      >
        <span
          className={mergeClassNames(
            'absolute top-[3px] left-[3px] rounded-full bg-white transition-transform',
            sm ? 'size-3.5' : 'size-[22px]',
            checked && (sm ? 'translate-x-3.5' : 'translate-x-5'),
          )}
        />
      </button>
      {!hideLabel && <span className="text-sm">{label}</span>}
    </label>
  );
}

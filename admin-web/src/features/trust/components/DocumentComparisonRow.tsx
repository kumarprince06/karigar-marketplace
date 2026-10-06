import type { ReactNode } from 'react';

/** One row of the "worker typed / you confirm" grid: label, the worker's value, the reviewer's control. */
export function DocumentComparisonRow({
  label,
  controlId,
  typedValue,
  children,
}: {
  label: string;
  controlId: string;
  typedValue: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <label htmlFor={controlId} className="text-fg-muted max-sm:text-fg max-sm:mt-2 max-sm:font-semibold">
        {label}
      </label>
      <span className="min-w-0">
        <span className="text-fg-muted sm:hidden">Worker typed: </span>
        {typedValue}
      </span>
      {children}
    </>
  );
}

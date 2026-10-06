import { useEffect, useId, useRef, type ReactNode } from 'react';
import { mergeClassNames } from '@/lib/merge-class-names';

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Right side of the title row, e.g. the permission the action needs. */
  aside?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  children?: ReactNode;
}

const sizes = { md: 'w-[560px]', lg: 'w-[720px]', xl: 'w-[880px]' } as const;

/**
 * Native <dialog> in modal mode: focus trap, Esc to close, inert background and
 * top-layer stacking come from the browser.
 */
export function ModalDialog({
  open,
  onClose,
  title,
  aside,
  description,
  footer,
  size = 'md',
  children,
}: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className={mergeClassNames(
        'bg-surface text-fg shadow-e3 m-auto max-h-[90vh] max-w-[calc(100vw-32px)] rounded-xl p-0',
        sizes[size],
      )}
    >
      {open && (
        <div className="flex flex-col gap-3 p-5">
          <header className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-h3 font-semibold">
              {title}
            </h2>
            {aside}
          </header>
          {description && <div className="text-fg-muted text-sm">{description}</div>}
          {children}
          {footer && <footer className="mt-1 flex justify-end gap-2">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Dialog open state kept in the URL (?dialog=name), so every dialog is deep-linkable,
 * survives refresh, and the browser Back button closes it.
 */
export function useUrlDialog(name: string) {
  const [params, setParams] = useSearchParams();
  const isOpen = params.get('dialog') === name;

  const openDialog = useCallback(
    (extra?: Record<string, string>) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('dialog', name);
        Object.entries(extra ?? {}).forEach(([k, v]) => next.set(k, v));
        return next;
      }),
    [name, setParams],
  );

  const closeDialog = useCallback(
    () =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('dialog');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return { isOpen, openDialog, closeDialog, params } as const;
}

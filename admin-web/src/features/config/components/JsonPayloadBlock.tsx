/** Read-only JSON (audit metadata). Ids and masked values only, never raw PII. */
export function JsonPayloadBlock({ value, label }: { value: unknown; label: string }) {
  return (
    <pre
      aria-label={label}
      className="bg-ink text-sidebar-fg overflow-x-auto rounded-md px-3 py-2.5 font-mono text-xs leading-[18px] whitespace-pre"
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

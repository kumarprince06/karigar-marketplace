import { useId } from 'react';
import { describeNameMatchBand } from '../name-match-band';

/** Penny-drop name-match score on a red / amber / green band, with the score also given as text. */
export function NameMatchMeter({ score }: { score: number }) {
  const labelId = useId();
  const clampedScore = Math.min(100, Math.max(0, score));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span id={labelId}>Name match</span>
        <b>{clampedScore} / 100</b>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedScore}
        aria-valuetext={`${clampedScore} out of 100, ${describeNameMatchBand(clampedScore)}`}
        className="relative my-1.5 h-2.5 rounded-full bg-linear-[to_right,var(--color-error)_50%,var(--color-accent)_50%_80%,var(--color-success)_80%]"
      >
        <i
          aria-hidden
          className="bg-fg absolute -top-[5px] h-5 w-1 -translate-x-1/2 rounded-sm"
          style={{ left: `${clampedScore}%` }}
        />
      </div>
      <div className="text-fg-subtle flex justify-between text-[13px]">
        <span>&lt; 50 auto-disabled</span>
        <span>50–79 review</span>
        <span>≥ 80 auto-active</span>
      </div>
    </div>
  );
}

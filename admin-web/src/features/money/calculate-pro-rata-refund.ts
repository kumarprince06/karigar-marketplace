/**
 * Pro-rata reversal of a payment's original split (LLD-011 D8), in integer paise.
 *
 * Static-design stand-in: in production the split comes from the backend (LLD-011 D9) and is never
 * computed in the browser. Kept pure and free of '@/' imports so its self-check runs under plain Node.
 */

export interface SplitLine {
  id: string;
  label: string;
  amountPaise: number;
}

export interface ProRataRefundLine extends SplitLine {
  refundPaise: number;
}

/**
 * Each line gives back `line × refund ÷ total`, floored to whole paise. The paise lost to flooring go,
 * one each, to the lines with the largest remainders, so the lines always add up to the refund exactly.
 */
export function calculateProRataRefund(
  splitLines: readonly SplitLine[],
  refundPaise: number,
): ProRataRefundLine[] {
  const totalPaise = splitLines.reduce((sum, line) => sum + line.amountPaise, 0);
  if (!Number.isInteger(refundPaise) || refundPaise < 0 || refundPaise > totalPaise) {
    throw new RangeError(`Refund ${refundPaise} must be whole paise between 0 and ${totalPaise}`);
  }
  if (totalPaise === 0) return splitLines.map((line) => ({ ...line, refundPaise: 0 }));

  const flooredLines = splitLines.map((line, index) => {
    const scaledPaise = line.amountPaise * refundPaise;
    return {
      index,
      refundPaise: Math.floor(scaledPaise / totalPaise),
      remainder: scaledPaise % totalPaise,
    };
  });
  const leftoverPaise = refundPaise - flooredLines.reduce((sum, line) => sum + line.refundPaise, 0);
  const indexesGettingOnePaisa = new Set(
    [...flooredLines]
      .sort((first, second) => second.remainder - first.remainder || first.index - second.index)
      .slice(0, leftoverPaise)
      .map((line) => line.index),
  );

  return splitLines.map((line, index) => ({
    ...line,
    refundPaise: (flooredLines[index]?.refundPaise ?? 0) + (indexesGettingOnePaisa.has(index) ? 1 : 0),
  }));
}

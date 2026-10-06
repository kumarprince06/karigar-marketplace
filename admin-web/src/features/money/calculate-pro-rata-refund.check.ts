/* Self-check: node --experimental-strip-types src/features/money/calculate-pro-rata-refund.check.ts */
// @ts-expect-error -- Node needs the .ts extension; the bundler tsconfig does not allow it.
import { calculateProRataRefund } from './calculate-pro-rata-refund.ts';

const designSplit = [
  { id: 'worker', label: 'Worker share', amountPaise: 163_170 },
  { id: 'fee', label: 'Platform fee', amountPaise: 18_500 },
  { id: 'gst', label: 'GST on fee', amountPaise: 3_330 },
];
const refundsOf = (refundPaise: number, split = designSplit) =>
  calculateProRataRefund(split, refundPaise).map((line: { refundPaise: number }) => line.refundPaise);
const sumOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

// A-05b mockup: ₹500 of ₹1,850 gives worker ₹441, fee ₹50, GST ₹9.
console.assert(JSON.stringify(refundsOf(50_000)) === '[44100,5000,900]', 'design example');
console.assert(JSON.stringify(refundsOf(0)) === '[0,0,0]', 'zero refund');
console.assert(JSON.stringify(refundsOf(185_000)) === '[163170,18500,3330]', 'full refund');
// Rounding never loses or invents a paisa.
for (const refundPaise of [1, 2, 99, 333, 12_345, 99_999, 184_999]) {
  console.assert(sumOf(refundsOf(refundPaise)) === refundPaise, `sum for ${refundPaise}`);
}
const thirds = [1, 2, 3].map((index) => ({ id: `${index}`, label: `${index}`, amountPaise: 100 }));
console.assert(JSON.stringify(refundsOf(100, thirds)) === '[34,33,33]', 'leftover paisa goes to first tie');
let threwForOverRefund = false;
try {
  refundsOf(185_001);
} catch {
  threwForOverRefund = true;
}
console.assert(threwForOverRefund, 'refund above the payment throws');

console.log('calculate-pro-rata-refund: checks done (any failure is printed above as "Assertion failed")');

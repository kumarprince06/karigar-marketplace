/** Penny-drop name-match bands (LLD-019): < 50 auto-disabled, 50–79 review, ≥ 80 auto-active. */
export function describeNameMatchBand(score: number): string {
  if (score < 50) return 'auto-disabled band';
  if (score < 80) return 'review band';
  return 'auto-active band';
}

export function getNameMatchScoreClassName(score: number): string {
  if (score < 50) return 'text-error';
  if (score < 80) return 'text-warning';
  return 'text-success';
}

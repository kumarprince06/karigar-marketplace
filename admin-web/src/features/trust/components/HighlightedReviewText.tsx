const escapeForRegularExpression = (phrase: string) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Review text with the phrases the content filter flagged wrapped in <mark>. */
export function HighlightedReviewText({
  text,
  flaggedPhrases,
}: {
  text: string;
  flaggedPhrases: readonly string[];
}) {
  if (flaggedPhrases.length === 0) return text;
  const flaggedPattern = new RegExp(`(${flaggedPhrases.map(escapeForRegularExpression).join('|')})`);
  // split() with a capture group keeps the matches at odd indexes.
  return text.split(flaggedPattern).map((part, partIndex) =>
    partIndex % 2 === 1 ? (
      <mark key={partIndex} className="bg-error-subtle text-error rounded-[3px] px-[3px] font-semibold">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

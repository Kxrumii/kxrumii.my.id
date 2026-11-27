export type TextPiece = { kind: 'word'; text: string } | { kind: 'image'; index: number };

/**
 * Splits `text` into words and slots `imageCount` inline images between them, spread evenly and never at
 * the very start or end, so the About statement reads as a sentence with pictures inside it.
 */
export function interleave(text: string, imageCount: number): TextPiece[] {
  const words = text.split(/\s+/).filter(Boolean);
  const pieces: TextPiece[] = [];
  const count = Math.max(0, Math.min(Math.floor(imageCount), Math.max(words.length - 1, 0)));
  // Image k goes after word floor((k + 1) * words / (count + 1)).
  const after = new Set(Array.from({ length: count }, (_, k) => Math.floor(((k + 1) * words.length) / (count + 1))));
  let image = 0;
  words.forEach((word, i) => {
    pieces.push({ kind: 'word', text: word });
    if (after.has(i + 1) && image < count && i < words.length - 1) {
      pieces.push({ kind: 'image', index: image });
      image += 1;
    }
  });
  return pieces;
}

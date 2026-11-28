export type TextPiece = { kind: 'word'; text: string } | { kind: 'image'; index: number };

/**
 * Pecah `text` jadi kata-kata dan selipin `imageCount` gambar inline di antaranya, tersebar rata dan nggak pernah
 * di awal atau akhir, biar pernyataan About kebaca kayak kalimat dengan gambar di dalamnya.
 */
export function interleave(text: string, imageCount: number): TextPiece[] {
  const words = text.split(/\s+/).filter(Boolean);
  const pieces: TextPiece[] = [];
  const count = Math.max(0, Math.min(Math.floor(imageCount), Math.max(words.length - 1, 0)));
  // Gambar ke-k ditaruh setelah kata floor((k + 1) * words / (count + 1)).
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

/**
 * Parses a video timestamp into seconds: "75", "75.5", "1:15", "1:15.5" or "1:02:03". Throws on anything else, so a
 * typo in tools/media.mjs fails loudly instead of grabbing the wrong frame.
 *
 * @param {string | number} value
 * @returns {number}
 */
export function parseTimestamp(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new Error(`invalid timestamp: ${value}`);
    return value;
  }
  const match = /^(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(String(value).trim());
  if (!match) throw new Error(`invalid timestamp: "${value}" (use 75, 1:15, 1:15.5 or 1:02:03)`);
  const [, a, b, s] = match;
  const seconds = Number.parseFloat(s);
  if ((a !== undefined || b !== undefined) && seconds >= 60) throw new Error(`invalid timestamp: "${value}" (seconds must be under 60)`);
  if (a !== undefined && b !== undefined) {
    const minutes = Number(b);
    if (minutes >= 60) throw new Error(`invalid timestamp: "${value}" (minutes must be under 60)`);
    return Number(a) * 3600 + minutes * 60 + seconds;
  }
  return (a === undefined ? 0 : Number(a) * 60) + seconds;
}

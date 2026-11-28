import type {
  BoxArchetype,
  BoxProportion,
  BoxVisualSpec,
  DeadlineState,
  FallbackSurface,
  SolidTone,
  Task,
  TexturePattern,
} from './types.ts';

const TEXTURE_PATTERNS: readonly TexturePattern[] = ['grain', 'dots', 'grid'];

const ALL_ARCHETYPES: readonly BoxArchetype[] = [
  'serif-split',
  'grotesk-block',
  'mixed-editorial',
  'scale-italic',
  'mono-hybrid',
  'condensed-poster',
];

const ARCHETYPE_TONES: Record<BoxArchetype, readonly SolidTone[]> = {
  'serif-split': ['paper', 'sand', 'charcoal'],
  'grotesk-block': ['charcoal', 'paper', 'terracotta'],
  'mixed-editorial': ['cobalt', 'charcoal', 'terracotta'],
  'scale-italic': ['sand', 'paper', 'sage'],
  'mono-hybrid': ['sage', 'sand', 'paper'],
  'condensed-poster': ['terracotta', 'cobalt', 'charcoal'],
};

/** Hash 32-bit dari `id` tugas, supaya gaya visual stabil tiap render. */
export function hashTaskId(id: number): number {
  const safeId = Number.isFinite(id) ? Math.abs(Math.trunc(id)) : 1;
  return (Math.imul(safeId || 1, 2654435761) >>> 0);
}

/**
 * Pilih gaya latar bawaan (cuma 'solid' atau 'texture'), stabil per tugas
 * walau diedit, difilter, dimuat ulang, atau ganti tema.
 */
export function resolveFallbackSurface(taskId: number): FallbackSurface {
  return hashTaskId(taskId) % 3 === 0 ? 'texture' : 'solid';
}

export function resolveTexturePattern(taskId: number): TexturePattern {
  const index = (hashTaskId(taskId) >>> 4) % TEXTURE_PATTERNS.length;
  return TEXTURE_PATTERNS[index] ?? 'grain';
}

export function resolveBoxArchetype(
  task: Pick<Task, 'id' | 'title'>,
  urgency: DeadlineState,
): BoxArchetype {
  const trimmed = task.title.trim();
  const words = trimmed === '' ? [] : trimmed.split(/\s+/);
  const h = hashTaskId(task.id);

  if (/\s[&/:—]\s|[&/]/.test(trimmed)) {
    return 'mono-hybrid';
  }
  if ((urgency === 'overdue' || urgency === 'today') && words.length >= 2) {
    return 'condensed-poster';
  }
  if (words.length <= 2) {
    return ((h >>> 2) % 2 === 0) ? 'grotesk-block' : 'serif-split';
  }
  if (words.length >= 5) {
    return ((h >>> 2) % 2 === 0) ? 'mixed-editorial' : 'condensed-poster';
  }
  return ALL_ARCHETYPES[(h >>> 2) % ALL_ARCHETYPES.length] ?? 'serif-split';
}

export function resolveBoxProportion(archetype: BoxArchetype, taskId: number): BoxProportion {
  if (archetype === 'mixed-editorial' || archetype === 'condensed-poster') {
    return 'landscape';
  }
  if (archetype === 'scale-italic') {
    return 'tall';
  }
  return (hashTaskId(taskId) >>> 6) % 5 === 0 ? 'tall' : 'portrait';
}

export function resolveSolidTone(
  taskId: number,
  archetype: BoxArchetype,
  urgency: DeadlineState,
): SolidTone {
  if (urgency === 'overdue') {
    return 'terracotta';
  }
  const palette = ARCHETYPE_TONES[archetype];
  const index = (hashTaskId(taskId) >>> 8) % palette.length;
  return palette[index] ?? 'paper';
}

/**
 * Pecah judul jadi 1–3 baris buat sampul kotak. Judul penuh tetap utuh
 * di `aria-label` dan Reader Dialog.
 */
export function splitTitleLines(title: string, maxLines = 3): string[] {
  const normalized = title.trim().replace(/\s+/g, ' ');
  if (normalized === '') return [''];

  const words = normalized.split(' ');
  if (words.length === 1 || maxLines <= 1) {
    return [normalized];
  }
  if (words.length === 2) {
    return [words[0]!, words[1]!];
  }

  const targetLines = words.length === 3 && normalized.length <= 26 ? 3 : Math.min(maxLines, words.length >= 4 ? 3 : 2);
  const targetChars = Math.max(8, Math.ceil(normalized.length / targetLines));
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]!;
    if (current === '') {
      current = word;
      continue;
    }
    const candidate = `${current} ${word}`;
    if (lines.length < targetLines - 1 && candidate.length > targetChars && current.length >= 3) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== '') {
    lines.push(current);
  }

  // Baris terakhir diringkas cuma kalau kepanjangan, biar poster tetap kebaca.
  const limit = 28;
  return lines.slice(0, maxLines).map((line, index) => {
    if (index === maxLines - 1 && lines.length > maxLines) {
      const merged = [line, ...lines.slice(maxLines)].join(' ');
      return merged.length > limit ? `${merged.slice(0, limit - 1).trimEnd()}…` : merged;
    }
    if (index === lines.length - 1 && line.length > 42 && words.length > 3) {
      return `${line.slice(0, 39).trimEnd()}…`;
    }
    return line;
  });
}

/** Spesifikasi visual satu kotak tugas (nanti bisa diperluas buat cover M3a). */
export function resolveBoxVisual(task: Task, urgency: DeadlineState): BoxVisualSpec {
  const archetype = resolveBoxArchetype(task, urgency);
  const surface = resolveFallbackSurface(task.id);
  const tone = resolveSolidTone(task.id, archetype, urgency);
  const texture = resolveTexturePattern(task.id);
  const proportion = resolveBoxProportion(archetype, task.id);
  const lines = splitTitleLines(task.title);

  return { archetype, surface, tone, texture, proportion, lines };
}

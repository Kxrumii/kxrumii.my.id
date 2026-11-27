/*
 * SAMPLE DATA — eksperimen contoh. Ganti dengan eksperimen, tes editing, atau
 * potongan proses yang nyata sebelum publikasi.
 */
import type { PlaygroundItem, PlaygroundKind } from '../types';

export const KIND_LABELS: Record<PlaygroundKind, string> = {
  'edit-test': 'Edit Test',
  process: 'Process',
  concept: 'Concept',
  motion: 'Motion',
};

export const playgroundItems: PlaygroundItem[] = [
  { id: 'sample-play-01', title: 'Sample Experiment 01', kind: 'edit-test', note: 'Catatan contoh. Ganti dengan eksperimen nyata.', isSample: true },
  { id: 'sample-play-02', title: 'Sample Experiment 02', kind: 'process', note: 'Catatan contoh. Ganti dengan potongan proses nyata.', isSample: true },
  { id: 'sample-play-03', title: 'Sample Experiment 03', kind: 'concept', note: 'Catatan contoh. Ganti dengan konsep nyata.', isSample: true },
  { id: 'sample-play-04', title: 'Sample Experiment 04', kind: 'motion', note: 'Catatan contoh. Ganti dengan tes gerak nyata.', isSample: true },
];

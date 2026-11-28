import type { Ref } from 'react';
import type { Work } from '../../types';

interface PrevProjectProps {
  prev: Work;
  hintRef: Ref<HTMLDivElement>;
  fillRef: Ref<HTMLSpanElement>;
}

/**
 * Muncul di atas pas pengunjung terus scroll ke atas melewati puncak project: "previous · judul" dengan bar
 * yang terisi; penuh → karya sebelumnya (useEdgeNavigation).
 */
export function PrevProject({ prev, hintRef, fillRef }: PrevProjectProps) {
  return (
    <div ref={hintRef} className="prev-hint" data-active="false" aria-hidden="true">
      <span className="prev-pill">
        <span className="prev-arrow">↑</span> previous · {prev.title}
      </span>
      <span className="prev-bar">
        <span ref={fillRef} className="prev-fill" />
      </span>
    </div>
  );
}

import type { Ref } from 'react';
import type { Work } from '../../types';

interface PrevProjectProps {
  prev: Work;
  hintRef: Ref<HTMLDivElement>;
  fillRef: Ref<HTMLSpanElement>;
}

/**
 * Appears at the top while the visitor keeps scrolling up past the top of a project: "previous · title" with a
 * bar that fills; full → the previous work (useEdgeNavigation).
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

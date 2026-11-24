import type { CSSProperties } from 'react';
import { Fragment } from 'react';

interface WordRevealProps {
  text: string;
  className?: string;
}

/**
 * Pacôme-style paragraph reveal: each word fades 0.25 -> 1 with a ~25 ms stagger (CSS only).
 * The words are real text separated by real spaces, so screen readers read the sentence
 * and copy-paste keeps every space. Reduced motion shows all words at once (see pages.css).
 */
export function WordReveal({ text, className }: WordRevealProps) {
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <p className={['word-reveal', className].filter(Boolean).join(' ')}>
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          {index > 0 ? ' ' : null}
          <span className="word" style={{ '--w': index } as CSSProperties}>
            {word}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

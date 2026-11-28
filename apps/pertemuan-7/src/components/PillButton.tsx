import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from 'react';
import { playSound } from '../audio/sound';

/** Pecah label jadi huruf-huruf biar pas hover bisa berombak satu-satu. */
export function Letters({ text }: { text: string }) {
  return (
    <span className="letters">
      <span className="sr-only">{text}</span>
      {Array.from(text).map((char, i) => (
        <span key={i} className="letter" aria-hidden="true" style={{ '--l': i } as CSSProperties}>
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
  );
}

type Tone = 'light' | 'dark';

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: Tone;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function PillButton({ label, tone = 'light', className, onPointerEnter, children, ref, ...rest }: PillButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      ref={ref}
      className={['pill', `pill-${tone}`, className].filter(Boolean).join(' ')}
      onPointerEnter={(event) => {
        playSound('hover');
        onPointerEnter?.(event);
      }}
    >
      <Letters text={label} />
      {children}
    </button>
  );
}

/** Tampilan sama buat link (caller yang render <a>/<Link> dengan className="pill …"). */
export function pillClass(tone: Tone = 'light'): string {
  return `pill pill-${tone}`;
}

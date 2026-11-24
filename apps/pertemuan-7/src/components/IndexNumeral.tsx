import type { CSSProperties } from 'react';
import { transitionIndex } from '../transition';

interface IndexNumeralProps {
  /** 0-based index of the active work; -1 when nothing is visible. */
  index: number;
  total: number;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const pad = (value: number) => String(Math.max(0, value)).padStart(2, '0');

/**
 * Huy's "Selected work 01 /05". Each digit rolls inside a fixed 1em window
 * (tabular figures), so changing the number never changes the layout.
 */
export function IndexNumeral({ index, total }: IndexNumeralProps) {
  const current = index >= 0 ? index + 1 : 0;

  return (
    <div className="index-numeral" data-transition-exit="" data-transition-enter="" style={transitionIndex(3)}>
      <p className="ui-label">Selected work</p>
      <p className="index-numeral-value">
        <span className="visually-hidden">
          Karya {current} dari {total}
        </span>
        <span className="index-digits" aria-hidden="true">
          {pad(current)
            .split('')
            .map((digit, position) => (
              <span className="index-digit" key={position}>
                <span className="index-digit-strip" style={{ '--digit': Number(digit) } as CSSProperties}>
                  {DIGITS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </span>
              </span>
            ))}
        </span>
      </p>
      <p className="ui-label index-numeral-total" aria-hidden="true">
        /{pad(total)}
      </p>
    </div>
  );
}

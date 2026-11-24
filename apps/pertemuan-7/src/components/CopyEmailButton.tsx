import { useEffect, useId, useState } from 'react';
import { useSound } from '../audio/useSound';

interface CopyEmailButtonProps {
  email: string;
  label?: string;
  className?: string;
  /** `display` sets the address in large type (Contact page). */
  variant?: 'inline' | 'display';
  /** Adds a plain mailto: link as the no-clipboard fallback. */
  mailtoFallback?: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** Copies an address to the clipboard with a short, announced status (Huy's copy-email pattern). */
export function CopyEmailButton({ email, label, className, variant = 'inline', mailtoFallback = false }: CopyEmailButtonProps) {
  const [state, setState] = useState<CopyState>('idle');
  const statusId = useId();
  const { play } = useSound();

  useEffect(() => {
    if (state === 'idle') return;
    const id = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(id);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setState('copied');
      play('click');
    } catch {
      setState('failed');
    }
  }

  return (
    <span className={['copy-email', variant === 'display' ? 'copy-email-display' : '', className].filter(Boolean).join(' ')} data-copy-state={state}>
      {label ? <span className="ui-label">{label}</span> : null}
      <button type="button" className="copy-email-button" onClick={copy} aria-describedby={statusId}>
        {email}
      </button>
      <span id={statusId} className="copy-email-status" role="status">
        {state === 'copied' ? 'Tersalin' : state === 'failed' ? 'Gagal menyalin, salin manual' : ''}
      </span>
      {mailtoFallback ? (
        <a className="copy-email-mailto" href={`mailto:${email}`} onClick={() => play('click')}>
          Kirim lewat aplikasi email ↗
        </a>
      ) : null}
    </span>
  );
}

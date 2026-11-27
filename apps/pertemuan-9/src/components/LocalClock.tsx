import { useEffect, useState } from 'react';

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Visitor's local time (Huy's "Working globally" slot) — no location is assumed. */
export function LocalClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p className="local-clock">
      <span className="ui-label">Waktu lokal</span>
      <time dateTime={now.toISOString()}>{timeFormat.format(now)}</time>
    </p>
  );
}

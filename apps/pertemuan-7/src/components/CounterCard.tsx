import { useState } from 'react';

export function CounterCard() {
  const [count, setCount] = useState(0);

  return (
    <section className="counter-card" aria-labelledby="counter-title">
      <div>
        <p className="eyebrow">INTERACTION SAMPLE</p>
        <h2 id="counter-title">React state</h2>
        <p>Contoh kecil penggunaan useState dan event handling.</p>
      </div>
      <div className="counter-controls">
        <output aria-live="polite">{count}</output>
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          Tambah
        </button>
        <button type="button" className="secondary-button" onClick={() => setCount(0)}>
          Reset
        </button>
      </div>
    </section>
  );
}

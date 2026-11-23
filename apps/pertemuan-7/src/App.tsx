import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { CounterCard } from './components/CounterCard';
import { FeatureCard } from './components/FeatureCard';
import { StatusBadge } from './components/StatusBadge';
import { transitionIndex, usePageReady } from './transition';

const foundationFeatures = [
  'Component-based UI',
  'Props dan state',
  'Event handling',
  'Conditional dan list rendering',
];

export default function App() {
  usePageReady();

  return (
    <main className="page-shell">
      <AppHeader />
      <section className="hero-block" data-transition-exit="" data-transition-enter="" style={transitionIndex(1)}>
        <p className="eyebrow">PAW / PERTEMUAN 07</p>
        <h1>React workspace.</h1>
        <p className="hero-copy">
          Kerangka awal untuk aplikasi React. Tema dan fitur akhir akan ditentukan
          pada tahap implementasi Tugas 7.
        </p>
        <StatusBadge label="Foundation ready" />
      </section>
      <section className="feature-grid" aria-label="Fondasi React" data-transition-exit="" data-transition-enter="" style={transitionIndex(2)}>
        {foundationFeatures.map((feature) => (
          <FeatureCard key={feature} title={feature} />
        ))}
      </section>
      <CounterCard />
      <AppFooter />
    </main>
  );
}

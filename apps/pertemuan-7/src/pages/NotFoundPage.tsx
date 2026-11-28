import { playSound } from '../audio/sound';
import { Letters, pillClass } from '../components/PillButton';
import { TransitionLink } from '../components/TransitionLink';
import { usePageTitle } from '../hooks/usePageTitle';
import { transitionIndex } from '../transition';

export function NotFoundPage() {
  usePageTitle('not found');
  return (
    <section className="not-found" data-transition-enter data-transition-exit style={transitionIndex(0)}>
      <h1>nothing here.</h1>
      <TransitionLink to="/" className={pillClass('light')} onPointerEnter={() => playSound('hover')} onClick={() => playSound('click')}>
        <Letters text="back to works" />
      </TransitionLink>
    </section>
  );
}

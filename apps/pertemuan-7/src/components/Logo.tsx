import { playSound } from '../audio/sound';
import { profile } from '../data/profile';
import { LogoMark } from './LogoMark';
import { TransitionLink } from './TransitionLink';

/** Top-left mark. Hovering tilts a name tag out of it with a spring. */
export function Logo() {
  return (
    <TransitionLink
      to="/"
      className="logo"
      aria-label={`${profile.handle} — works`}
      onPointerEnter={() => playSound('hover')}
      onClick={() => playSound('click')}
    >
      <LogoMark className="logo-mark" />
      <span className="logo-tag" aria-hidden="true">
        <span className="logo-tag-pill">
          {profile.handle}
          <span className="logo-tag-dot" />
        </span>
        <svg className="logo-tag-star" viewBox="0 0 32 32">
          <path d="M16 0l3.2 12.8L32 16l-12.8 3.2L16 32l-3.2-12.8L0 16l12.8-3.2z" fill="currentColor" />
        </svg>
      </span>
    </TransitionLink>
  );
}

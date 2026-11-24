import { profile } from '../data/profile';
import { transitionIndex } from '../transition';
import { StatusBadge } from './StatusBadge';

export function SiteFooter() {
  return (
    <footer className="site-footer" data-transition-exit="" data-transition-enter="" style={transitionIndex(4)}>
      <span>
        {profile.name} · NIM {profile.nim}
      </span>
      {profile.isSample ? <StatusBadge label="Sample data" /> : null}
    </footer>
  );
}

import { profile } from '../data/profile';
import { Stage } from '../components/Stage';

export function AboutPage() {
  return (
    <Stage name="about" title="About" eyebrow="ABOUT">
      <p className="page-copy">{profile.intro}</p>
      <p className="page-meta">
        {profile.name} · NIM {profile.nim}
      </p>
    </Stage>
  );
}

import { profile } from '../data/profile';
import { Page } from '../components/Page';

export function AboutPage() {
  return (
    <Page name="about" title="About" eyebrow="ABOUT">
      <p className="page-copy">{profile.intro}</p>
      <p className="page-meta">
        {profile.name} · NIM {profile.nim}
      </p>
    </Page>
  );
}

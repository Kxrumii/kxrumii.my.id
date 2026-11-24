import { MetaList } from '../components/MetaList';
import { Stage } from '../components/Stage';
import { StatusBadge } from '../components/StatusBadge';
import { WordReveal } from '../components/WordReveal';
import { profile } from '../data/profile';

const orBlank = (value: string | null | undefined) => (value && value.trim() !== '' ? value : 'Belum diisi');

export function AboutPage() {
  return (
    <Stage name="about" title="About" eyebrow="ABOUT">
      <div className="about-layout">
        <WordReveal className="about-copy" text={profile.intro} />
        <aside className="about-side" aria-label="Ringkasan profil">
          <div className="about-identity">
            <p className="ui-label">Nama · NIM</p>
            <p className="about-name">{profile.name}</p>
            <p className="about-nim">NIM {profile.nim}</p>
            {profile.isSample ? <StatusBadge label="Sample data" /> : null}
          </div>
          <MetaList
            items={[
              { label: 'Peran', value: orBlank(profile.role) },
              { label: 'Fokus kreatif', value: orBlank(profile.focus.join(' · ')) },
              { label: 'Perangkat', value: orBlank(profile.tools.join(' · ')) },
              { label: 'Tagline', value: profile.tagline },
            ]}
          />
        </aside>
      </div>
    </Stage>
  );
}

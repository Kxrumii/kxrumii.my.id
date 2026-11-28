import { SocialLinks } from '../components/SocialLinks';
import { WorkCover } from '../components/WorkCover';
import { profile } from '../data/profile';
import { works } from '../data/works';
import { usePageTitle } from '../hooks/usePageTitle';
import { transitionIndex } from '../transition';
import { interleave } from '../utils/interleave';
import { workNumber } from '../utils/works';

const INLINE_IMAGES = 4;

export function AboutPage() {
  usePageTitle('about');
  const statement = profile.intro;
  const covers = works.slice(0, INLINE_IMAGES);
  const pieces = interleave(statement, covers.length);

  return (
    <article className="about" aria-labelledby="about-title">
      <h1 id="about-title" className="sr-only">
        About
      </h1>
      <p className="about-text" data-transition-enter data-transition-exit style={transitionIndex(0)}>
        {pieces.map((piece, i) =>
          piece.kind === 'word' ? (
            <span key={i} className="about-word">
              {piece.text}{' '}
            </span>
          ) : (
            <span key={i} className="about-image" style={transitionIndex(piece.index)} aria-hidden="true">
              <WorkCover work={covers[piece.index]} number={workNumber(piece.index)} eager />{' '}
            </span>
          ),
        )}
      </p>
      {profile.quote ? (
        <blockquote className="about-quote" data-transition-enter data-transition-exit style={transitionIndex(1)}>
          “{profile.quote}”
        </blockquote>
      ) : null}
      <footer className="about-footer" data-transition-enter data-transition-exit style={transitionIndex(2)}>
        <div>
          <p className="about-label">elsewhere</p>
          <SocialLinks links={profile.socials} variant="labelled" />
        </div>
        {profile.email ? (
          <div>
            <p className="about-label">contact</p>
            <a className="about-mail" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
          </div>
        ) : null}
        <div className="about-credits">
          <p className="about-label">credits</p>
          <p>edit &amp; video by {profile.handle}</p>
          <p>layout inspired by Pacôme Pertant's portfolio</p>
          <p>pixel stars adapted from @uicapsule, ASCII wake inspired by @nikolas-sapa (21st.dev)</p>
          <p>music: Shelter (Official Piano Version) by Porter Robinson &amp; Madeon</p>
          <p>font: Inter Tight (SIL OFL)</p>
        </div>
      </footer>
    </article>
  );
}

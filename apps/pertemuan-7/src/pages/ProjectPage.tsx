import { useState } from 'react';
import { useParams } from 'react-router';
import { playSound } from '../audio/sound';
import { Letters, pillClass } from '../components/PillButton';
import { TransitionLink } from '../components/TransitionLink';
import { WorkCover } from '../components/WorkCover';
import { CATEGORY_LABELS, works } from '../data/works';
import { usePageTitle } from '../hooks/usePageTitle';
import { transitionIndex } from '../transition';
import { findWork, nextWork, workNumber } from '../utils/works';
import { NotFoundPage } from './NotFoundPage';

/** One work: big title, meta, cover/video, text and the next work. */
export function ProjectPage() {
  const { slug } = useParams();
  const work = findWork(works, slug);
  const [playing, setPlaying] = useState(false);
  usePageTitle(work?.title ?? 'not found');

  if (!work) return <NotFoundPage />;

  const index = works.indexOf(work);
  const number = workNumber(index);
  const next = nextWork(works, work.slug);
  const meta: Array<[string, string]> = [
    ['category', CATEGORY_LABELS[work.category]],
    ['year', work.year === null ? '—' : String(work.year)],
    ['role', work.role ?? '—'],
  ];

  return (
    <article className="project" aria-labelledby="project-title">
      <header className="project-head" data-transition-enter data-transition-exit style={transitionIndex(0)}>
        <TransitionLink to="/" className="project-back" onPointerEnter={() => playSound('hover')} onClick={() => playSound('click')}>
          ← works
        </TransitionLink>
        <p className="project-number">{number}</p>
        <h1 id="project-title" className="project-title">
          {work.title}
        </h1>
        <dl className="project-meta">
          {meta.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {work.isSample ? <p className="project-sample">sample entry — replace with a real work before publishing</p> : null}
      </header>

      <div className="project-media" data-transition-enter data-transition-exit style={transitionIndex(1)}>
        {playing && work.youtubeVideoId ? (
          <iframe
            className="project-video"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(work.youtubeVideoId)}?autoplay=1&rel=0`}
            title={`${work.title} — video`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <>
            <WorkCover work={work} number={number} eager className="project-cover" />
            {work.youtubeVideoId ? (
              <button
                type="button"
                className="project-play"
                onPointerEnter={() => playSound('hover')}
                onClick={() => {
                  playSound('click');
                  setPlaying(true);
                }}
              >
                <Letters text="play video" />
              </button>
            ) : null}
          </>
        )}
      </div>

      <section className="project-body" data-transition-enter data-transition-exit style={transitionIndex(2)}>
        <p className="project-summary">{work.summary}</p>
        {work.notes ? <p className="project-notes">{work.notes}</p> : null}
        {work.externalUrl ? (
          <a className={pillClass('light')} href={work.externalUrl} target="_blank" rel="noreferrer noopener" onPointerEnter={() => playSound('hover')}>
            <Letters text="open link" />
          </a>
        ) : null}
        {!work.youtubeVideoId && !work.externalUrl ? <p className="project-notes">video not available yet.</p> : null}
      </section>

      {next ? (
        <nav className="project-next" aria-label="Next work" data-transition-enter data-transition-exit style={transitionIndex(3)}>
          <p className="project-next-label">next project</p>
          <TransitionLink to={`/work/${next.slug}`} className="project-next-link" onPointerEnter={() => playSound('hover')} onClick={() => playSound('click')}>
            <span className="project-next-title">{next.title}</span>
            <WorkCover work={next} number={workNumber(works.indexOf(next))} className="project-next-cover" />
          </TransitionLink>
        </nav>
      ) : null}
    </article>
  );
}

import { useParams } from 'react-router';
import { playSound } from '../audio/sound';
import { NextProject } from '../components/project/NextProject';
import { ProjectInfos } from '../components/project/ProjectInfos';
import { ProjectPreview } from '../components/project/ProjectPreview';
import { ProjectStyleframes } from '../components/project/ProjectStyleframes';
import { TransitionLink } from '../components/TransitionLink';
import { works } from '../data/works';
import { usePageTitle } from '../hooks/usePageTitle';
import { transitionIndex } from '../transition';
import { findWork, nextWork, workNumber } from '../utils/works';
import { NotFoundPage } from './NotFoundPage';

/**
 * One work, laid out like the reference: a white card (preview, infos, styleframes) with a dark close button,
 * then the next work below it; scrolling on past the bottom opens that next work.
 */
export function ProjectPage() {
  const { slug } = useParams();
  const work = findWork(works, slug);
  usePageTitle(work?.title ?? 'not found');

  if (!work) return <NotFoundPage />;

  const number = workNumber(works.indexOf(work));
  const next = nextWork(works, work.slug);

  return (
    <article className="project">
      <div className="project-card" data-transition-enter data-transition-exit style={transitionIndex(0)}>
        <TransitionLink to="/" className="project-close" aria-label="close project" onPointerEnter={() => playSound('hover')} onClick={() => playSound('close')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </TransitionLink>
        <ProjectPreview work={work} number={number} />
        <ProjectInfos work={work} number={number} />
        <ProjectStyleframes work={work} number={number} />
      </div>
      {next ? <NextProject next={next} number={workNumber(works.indexOf(next))} /> : null}
    </article>
  );
}

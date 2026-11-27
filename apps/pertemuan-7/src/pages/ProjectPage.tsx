import { useEffect } from 'react';
import { useParams } from 'react-router';
import { playSound } from '../audio/sound';
import { NextProject } from '../components/project/NextProject';
import { PrevProject } from '../components/project/PrevProject';
import { ProjectInfos } from '../components/project/ProjectInfos';
import { ProjectPreview } from '../components/project/ProjectPreview';
import { ProjectStyleframes } from '../components/project/ProjectStyleframes';
import { TransitionLink } from '../components/TransitionLink';
import { works } from '../data/works';
import { useEdgeNavigation } from '../hooks/useEdgeNavigation';
import { usePageTitle } from '../hooks/usePageTitle';
import { transitionIndex } from '../transition';
import { coverImage, findWork, nextWork, prevWork, workNumber } from '../utils/works';
import { NotFoundPage } from './NotFoundPage';

/**
 * One work, laid out like the reference: a white card (preview, infos, styleframes) with a dark close button,
 * then the next work below it. Scrolling on past the bottom opens the next work; scrolling up past the top opens
 * the previous one.
 */
export function ProjectPage() {
  const { slug } = useParams();
  const work = findWork(works, slug);
  const next = work ? nextWork(works, work.slug) : null;
  const prev = work ? prevWork(works, work.slug) : null;
  const edges = useEdgeNavigation({ next: next ? `/work/${next.slug}` : null, prev: prev ? `/work/${prev.slug}` : null });
  usePageTitle(work?.title ?? 'not found');

  // Warm the neighbours' covers so the next page never paints an empty frame.
  useEffect(() => {
    for (const neighbour of [next, prev]) {
      const src = neighbour ? coverImage(neighbour) : null;
      if (src) new Image().src = src;
    }
  }, [next, prev]);

  if (!work) return <NotFoundPage />;

  const number = workNumber(works.indexOf(work));

  return (
    <article className="project">
      {prev ? <PrevProject prev={prev} hintRef={edges.prevHint} fillRef={edges.prevFill} /> : null}
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
      {next ? <NextProject next={next} number={workNumber(works.indexOf(next))} fillRef={edges.nextFill} /> : null}
    </article>
  );
}

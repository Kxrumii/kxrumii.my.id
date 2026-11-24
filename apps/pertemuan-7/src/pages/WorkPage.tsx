import { CATEGORY_LABELS, works } from '../data/works';
import { Page } from '../components/Page';
import { TransitionLink } from '../components/TransitionLink';

export function WorkPage() {
  return (
    <Page name="work" title="Selected Work" eyebrow="WORK">
      <ol className="stub-list">
        {works.map((work, index) => (
          <li key={work.slug}>
            <TransitionLink to={`/work/${work.slug}`}>
              <span className="stub-index">{String(index + 1).padStart(2, '0')}</span>
              <span>{work.title}</span>
              <span className="stub-meta">{CATEGORY_LABELS[work.category]}</span>
            </TransitionLink>
          </li>
        ))}
      </ol>
    </Page>
  );
}

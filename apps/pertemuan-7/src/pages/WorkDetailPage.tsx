import { useParams } from 'react-router';
import { CATEGORY_LABELS, works } from '../data/works';
import { Page } from '../components/Page';
import { TransitionLink } from '../components/TransitionLink';

export function WorkDetailPage() {
  const { slug } = useParams();
  const work = works.find((item) => item.slug === slug);

  if (!work) {
    return (
      <Page name="work-not-found" title="Karya tidak ditemukan" eyebrow="WORK">
        <p className="page-copy">Tidak ada karya dengan alamat “{slug}”.</p>
        <TransitionLink className="text-link" to="/">← Kembali ke Work</TransitionLink>
      </Page>
    );
  }

  return (
    <Page name="work-detail" title={work.title} eyebrow={`WORK / ${CATEGORY_LABELS[work.category].toUpperCase()}`}>
      <p className="page-copy">{work.summary}</p>
      <TransitionLink className="text-link" to="/">← Kembali ke Work</TransitionLink>
    </Page>
  );
}

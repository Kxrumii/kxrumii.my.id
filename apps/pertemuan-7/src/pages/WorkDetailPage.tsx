import { useParams } from 'react-router';
import { DisclosurePanel } from '../components/DisclosurePanel';
import { MetaList } from '../components/MetaList';
import { Stage } from '../components/Stage';
import { StatusBadge } from '../components/StatusBadge';
import { TransitionLink } from '../components/TransitionLink';
import { VideoEmbed } from '../components/VideoEmbed';
import { CATEGORY_LABELS, works } from '../data/works';

export function WorkDetailPage() {
  const { slug } = useParams();
  const work = works.find((item) => item.slug === slug);

  if (!work) {
    return (
      <Stage name="work-not-found" title="Karya tidak ditemukan" eyebrow="WORK">
        <p className="page-copy">Tidak ada karya dengan alamat “{slug}”.</p>
        <TransitionLink className="text-link" to="/">← Kembali ke Work</TransitionLink>
      </Stage>
    );
  }

  return (
    <Stage name="work-detail" title={work.title} eyebrow={`WORK / ${CATEGORY_LABELS[work.category].toUpperCase()}`}>
      {work.featured || work.isSample ? (
        <p className="badge-row">
          {work.featured ? <StatusBadge label="Featured" /> : null}
          {work.isSample ? <StatusBadge label="Sample" /> : null}
        </p>
      ) : null}
      <p className="page-copy">{work.summary}</p>
      <VideoEmbed key={`video-${work.slug}`} title={work.title} youtubeVideoId={work.youtubeVideoId} externalUrl={work.externalUrl} />
      <MetaList
        items={[
          { label: 'Tahun', value: work.year ?? 'Belum diisi' },
          { label: 'Kategori', value: CATEGORY_LABELS[work.category] },
          { label: 'Peran', value: work.role ?? 'Belum diisi' },
        ]}
      />
      <DisclosurePanel key={`notes-${work.slug}`} title="Catatan produksi">
        <p className="page-copy">{work.notes ?? 'Catatan belum diisi.'}</p>
      </DisclosurePanel>
      <TransitionLink className="text-link" to="/">← Kembali ke Work</TransitionLink>
    </Stage>
  );
}

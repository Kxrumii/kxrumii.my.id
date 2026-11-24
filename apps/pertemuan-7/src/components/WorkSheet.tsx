import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { Link, useLocation, useNavigate, useNavigationType, useParams } from 'react-router';
import { unduck } from '../audio/soundEngine';
import { useSound } from '../audio/useSound';
import { CATEGORY_LABELS, works } from '../data/works';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { originRect, playSheetClose, playSheetOpen, type OriginMode } from '../motion/sheetMotion';
import { useShell } from '../shell/shellContext';
import { INK_DARK, INK_LIGHT, cardFace, haloFor } from '../utils/cardFace';
import { DisclosurePanel } from './DisclosurePanel';
import { MetaList } from './MetaList';
import { SoundToggle } from './SoundToggle';
import { StatusBadge } from './StatusBadge';
import { VideoEmbed } from './VideoEmbed';

/** The hero media wears the orbit card's face; the inverse ink keeps the hovered play icon visible. */
const heroStyle = (work: { slug: string; thumbnail: string | null }): CSSProperties => {
  const face = cardFace(work);
  const ink = face.inks.center;
  return { '--hero-bg': face.background, '--hero-ink': ink, '--hero-halo': haloFor(ink), '--hero-ink-inverse': ink === INK_DARK ? INK_LIGHT : INK_DARK } as CSSProperties;
};

const focusTrigger = (slug: string) => {
  const trigger = document.querySelector<HTMLElement>(`[data-work-slug="${CSS.escape(slug)}"] a`);
  (trigger ?? document.getElementById('main'))?.focus({ preventScroll: true });
};

/**
 * Work detail as a modal <dialog> sheet over the Works stage (Pacôme's
 * /projects/:slug). It is the child route `work/:slug` of WorksStage, so the
 * stage (view mode, filters, active work) stays mounted underneath.
 *
 * Layers: .sheet-card (background), [data-sheet-hero] (the element that travels
 * from the stage: media from the spiral, title from the list) and
 * [data-sheet-reveal] content; see src/motion/sheetMotion.ts.
 *
 * Every way out funnels into requestClose(), which animates and then updates
 * the URL: close button, backdrop click, Esc (cancel is intercepted) and the
 * back link. Browser Back changes the URL first; the unmount cleanup handles
 * focus and audio. The dialog is never closed programmatically: React removes
 * it from the DOM, which also lifts the top layer, so no stray `close` event
 * can fire a second navigation.
 */
export function WorkSheet() {
  const { slug = '' } = useParams();
  const work = works.find((item) => item.slug === slug) ?? null;
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const { locked } = useShell();
  const reducedMotion = useReducedMotion();
  const { play } = useSound();
  const titleId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const mountedRef = useRef(false);
  const pointerDownOnBackdrop = useRef(false);
  const slugRef = useRef(slug);
  slugRef.current = slug;

  // The sheet was pushed from the stage (not a direct load or a Back/Forward replay):
  // only then is there a previous entry to return to and an origin to animate from.
  const linkState = location.state as { fromStage?: boolean; originMode?: OriginMode } | null;
  const openedFromStage = linkState?.fromStage === true;
  const originMode: OriginMode | null =
    openedFromStage && navigationType === 'PUSH' && (linkState?.originMode === 'spiral' || linkState?.originMode === 'list')
      ? linkState.originMode
      : null;
  const originModeRef = useRef(originMode);
  originModeRef.current = originMode;

  // Open once the sound gate is gone, so the top layer never covers the gate.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const surface = surfaceRef.current;
    if (!dialog || !surface || locked || dialog.open) return;
    dialog.showModal();
    play('open');
    dialog.querySelector<HTMLElement>('[data-sheet-focus]')?.focus({ preventScroll: true });
    if (!reducedMotion) {
      const mode = originModeRef.current;
      playSheetOpen(dialog, slugRef.current, mode, originRect(slugRef.current, mode));
    }
  }, [locked]);

  // Real unmount only (the StrictMode probe leaves the dialog connected): restore focus and audio.
  useEffect(() => {
    mountedRef.current = true;
    const dialog = dialogRef.current;
    return () => {
      mountedRef.current = false;
      if (dialog?.isConnected) return;
      unduck();
      focusTrigger(slugRef.current);
    };
  }, []);

  function leave() {
    if (!mountedRef.current) return;
    if (openedFromStage) navigate(-1);
    else navigate('/', { replace: true });
  }

  async function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    play('close');
    const dialog = dialogRef.current;
    if (dialog) dialog.dataset.closing = 'true';
    if (dialog && !reducedMotion) {
      const mode = originModeRef.current;
      await playSheetClose(dialog, slugRef.current, mode, originRect(slugRef.current, mode));
    } else if (dialog) {
      dialog.style.opacity = '0';
    }
    leave();
  }

  const onBackLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void requestClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="work-sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: keep the URL and the DOM in sync by closing through the router.
        event.preventDefault();
        void requestClose();
      }}
      onClose={() => {
        // Closed natively (e.g. a second Esc the browser no longer lets us cancel): follow with the URL.
        if (dialogRef.current?.open || closingRef.current) return;
        closingRef.current = true;
        leave();
      }}
      onPointerDown={(event: PointerEvent<HTMLDialogElement>) => {
        pointerDownOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pointerDownOnBackdrop.current) void requestClose();
        pointerDownOnBackdrop.current = false;
      }}
    >
      <div className="sheet-card" aria-hidden="true" />
      <div className="sheet-surface" ref={surfaceRef}>
        <header className="sheet-top" data-sheet-reveal="">
          <SoundToggle variant="text" className="sheet-audio" />
          <button type="button" className="sheet-close" data-sheet-focus="" onClick={() => void requestClose()}>
            Tutup <span aria-hidden="true">✕</span>
          </button>
        </header>

        {work ? (
          <article className="sheet-content">
            <div className="sheet-info">
              <p className="ui-label" data-sheet-reveal="">
                {CATEGORY_LABELS[work.category]} · Selected work
              </p>
              <h2 className="sheet-title" id={titleId} data-sheet-hero="title">
                {work.title}
              </h2>
              <div data-sheet-reveal="">
                <span className="sheet-dash" aria-hidden="true">—</span>
                <p className="sheet-summary">{work.summary}</p>
              </div>
              <div data-sheet-reveal="">
                <MetaList
                items={[
                  { label: 'Peran', value: work.role ?? 'Belum diisi' },
                  { label: 'Tahun', value: work.year ?? 'Belum diisi' },
                  { label: 'Kategori', value: CATEGORY_LABELS[work.category] },
                  ]}
                />
                {work.featured || work.isSample ? (
                  <p className="badge-row">
                    {work.featured ? <StatusBadge label="Featured" /> : null}
                    {work.isSample ? <StatusBadge label="Sample" /> : null}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="sheet-media">
              <div
                className="sheet-hero"
                data-sheet-hero="media"
                style={heroStyle(work)}
              >
                <VideoEmbed
                  key={`video-${work.slug}`}
                  title={work.title}
                  youtubeVideoId={work.youtubeVideoId}
                  externalUrl={work.externalUrl}
                />
              </div>
              <div data-sheet-reveal="">
                <DisclosurePanel key={`notes-${work.slug}`} title="Catatan produksi">
                  <p className="page-copy">{work.notes ?? 'Catatan belum diisi.'}</p>
                </DisclosurePanel>
              </div>
              <Link className="text-link" to="/" replace onClick={onBackLink} data-sheet-reveal="">
                ← Back to works
              </Link>
            </div>
          </article>
        ) : (
          <article className="sheet-content sheet-missing">
            <div className="sheet-info" data-sheet-reveal="">
              <p className="ui-label">Work</p>
              <h2 className="sheet-title" id={titleId}>
                Karya tidak ditemukan
              </h2>
              <p className="sheet-summary">Tidak ada karya dengan alamat “{slug}”.</p>
              <Link className="text-link" to="/" replace onClick={onBackLink}>
                ← Kembali ke Work
              </Link>
            </div>
          </article>
        )}
      </div>
    </dialog>
  );
}

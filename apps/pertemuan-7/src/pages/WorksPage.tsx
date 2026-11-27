import { useOutletContext, useSearchParams } from 'react-router';
import type { LayoutContext } from '../components/Layout';
import { ListView } from '../components/ListView';
import { SpiralView } from '../components/SpiralView';
import { ViewSwitch, type WorksView } from '../components/ViewSwitch';
import { works } from '../data/works';
import { usePageTitle } from '../hooks/usePageTitle';
import { transitionIndex } from '../transition';

/** Home: every work as a spiral (default) or as a list, switched at the top centre (`?view=list`). */
export function WorksPage() {
  const { entered, menuOpen } = useOutletContext<LayoutContext>();
  const [params, setParams] = useSearchParams();
  const view: WorksView = params.get('view') === 'list' ? 'list' : 'spiral';
  usePageTitle(view === 'list' ? 'works list' : null);

  const setView = (next: WorksView) => {
    setParams(next === 'list' ? { view: 'list' } : {}, { replace: true, preventScrollReset: true });
  };

  return (
    <>
      <h1 className="sr-only">Works</h1>
      <ViewSwitch view={view} onChange={setView} data-transition-enter data-transition-exit style={transitionIndex(0)} />
      <div className="works-stage" data-transition-enter data-transition-exit style={transitionIndex(1)}>
        {view === 'spiral' ? <SpiralView works={works} paused={!entered || menuOpen} /> : <ListView works={works} />}
      </div>
    </>
  );
}

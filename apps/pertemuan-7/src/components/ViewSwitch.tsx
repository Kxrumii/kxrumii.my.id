import type { HTMLAttributes } from 'react';
import { playSound } from '../audio/sound';
import { RollingLabel } from './RollingLabel';

export type WorksView = 'spiral' | 'list';

const VIEWS: WorksView[] = ['spiral', 'list'];

interface ViewSwitchProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  view: WorksView;
  onChange: (view: WorksView) => void;
}

/** Switch "spiral • list" di tengah atas halaman karya. */
export function ViewSwitch({ view, onChange, ...rest }: ViewSwitchProps) {
  return (
    <div {...rest} className="switch" role="group" aria-label="Works view">
      {VIEWS.map((item, index) => (
        <span key={item} className="switch-item">
          {index > 0 ? <span className="switch-dot" aria-hidden="true" /> : null}
          <button
            type="button"
            className={`switch-button${item === view ? ' active' : ''}`}
            aria-pressed={item === view}
            onPointerEnter={() => playSound('hover')}
            onClick={() => {
              if (item === view) return;
              playSound('click');
              onChange(item);
            }}
          >
            <RollingLabel text={item} />
          </button>
        </span>
      ))}
    </div>
  );
}

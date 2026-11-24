export type WorksView = 'spiral' | 'list';

interface ViewToggleProps {
  view: WorksView;
  onChange: (view: WorksView) => void;
}

const VIEWS: WorksView[] = ['spiral', 'list'];

/** Pacôme's "spiral • list" switch, as two pressed-state buttons. */
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="Tampilan karya">
      {VIEWS.map((option, index) => (
        <span key={option} className="view-toggle-item">
          {index > 0 ? <span className="view-toggle-dot" aria-hidden="true" /> : null}
          <button type="button" aria-pressed={view === option} onClick={() => onChange(option)}>
            {option}
          </button>
        </span>
      ))}
    </div>
  );
}

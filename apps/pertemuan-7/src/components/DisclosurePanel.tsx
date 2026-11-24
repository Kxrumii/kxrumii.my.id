import { useId, useState, type ReactNode } from 'react';

interface DisclosurePanelProps {
  title: string;
  defaultOpen?: boolean;
  /** Called after every toggle with the new state (e.g. to play a sound). */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

/** Show/hide section. The button owns `aria-expanded`; the panel stays in the DOM and toggles `hidden`. */
export function DisclosurePanel({ title, defaultOpen = false, onToggle, children }: DisclosurePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="disclosure">
      <h2 className="disclosure-heading">
        <button
          type="button"
          className="disclosure-button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            const next = !open;
            setOpen(next);
            onToggle?.(next);
          }}
        >
          <span>{title}</span>
          <span aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </h2>
      <div id={panelId} className="disclosure-panel" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

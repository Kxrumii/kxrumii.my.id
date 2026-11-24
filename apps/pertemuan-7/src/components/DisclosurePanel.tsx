import { useId, useState, type ReactNode } from 'react';

interface DisclosurePanelProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Show/hide section. The button owns `aria-expanded`; the panel stays in the DOM and toggles `hidden`. */
export function DisclosurePanel({ title, defaultOpen = false, children }: DisclosurePanelProps) {
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
          onClick={() => setOpen((value) => !value)}
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

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Shown when a list has nothing to display; the action button is optional. */
export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      <p className="empty-copy">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="chip" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

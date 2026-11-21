interface StatusBadgeProps {
  label: string;
}

export function StatusBadge({ label }: StatusBadgeProps) {
  return <span className="status-badge"><i aria-hidden="true" />{label}</span>;
}

interface RollingLabelProps {
  text: string;
}

/**
 * Two stacked copies of a label: on hover/active the first rolls down and out while the second rolls in
 * from above (the switch and nav labels). The copy is aria-hidden so the text is read once.
 */
export function RollingLabel({ text }: RollingLabelProps) {
  return (
    <span className="rolling">
      <span className="rolling-a">{text}</span>
      <span className="rolling-b" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}

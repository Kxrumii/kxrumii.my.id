interface RollingLabelProps {
  text: string;
}

/**
 * Dua salinan label bertumpuk: pas hover/active yang pertama menggulung turun keluar, yang kedua masuk dari atas
 * (label switch dan nav). Salinannya aria-hidden biar teksnya kebaca sekali aja.
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

interface FeatureCardProps {
  title: string;
}

export function FeatureCard({ title }: FeatureCardProps) {
  return (
    <article className="feature-card">
      <span className="card-mark" aria-hidden="true">✳</span>
      <h2>{title}</h2>
    </article>
  );
}

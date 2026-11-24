import { profile } from '../data/profile';
import { Stage } from '../components/Stage';

export function ContactPage() {
  return (
    <Stage name="contact" title="Contact" eyebrow="CONTACT">
      <p className="page-copy">{profile.email}</p>
    </Stage>
  );
}

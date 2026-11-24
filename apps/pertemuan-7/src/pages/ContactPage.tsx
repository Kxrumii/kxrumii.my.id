import { useSound } from '../audio/useSound';
import { CopyEmailButton } from '../components/CopyEmailButton';
import { Stage } from '../components/Stage';
import { profile } from '../data/profile';

export function ContactPage() {
  const { play } = useSound();

  return (
    <Stage name="contact" title="Contact" eyebrow="CONTACT">
      <p className="stage-lead">Punya ide, proyek, atau sekadar ingin menyapa? Salin alamat di bawah.</p>
      <CopyEmailButton email={profile.email} variant="display" mailtoFallback />
      <p className="contact-availability">
        <span className="ui-label">Ketersediaan</span>
        {profile.availability}
      </p>
      <ul className="contact-socials" aria-label="Tautan sosial">
        {profile.socials.map((social) => (
          <li key={social.url}>
            <a
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => play('hover')}
              onClick={() => play('click')}
            >
              {social.label} ↗
            </a>
          </li>
        ))}
      </ul>
    </Stage>
  );
}

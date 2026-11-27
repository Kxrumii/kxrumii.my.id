import { playSound } from '../audio/sound';
import { profile } from '../data/profile';
import type { SocialLink } from '../types';
import { SocialIcon } from './SocialIcon';

interface SocialLinksProps {
  links: SocialLink[];
  /** round: icon buttons with the handle appearing underneath on hover (menu); labelled: icon + handle (about). */
  variant: 'round' | 'labelled';
  className?: string;
}

/** The same four links and icons as the Pertemuan 1 footer. */
export function SocialLinks({ links, variant, className }: SocialLinksProps) {
  return (
    <ul className={[`socials socials-${variant}`, className].filter(Boolean).join(' ')}>
      {links.map((link) => (
        <li key={link.url}>
          <a
            className="social-link"
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Kunjungi ${link.label} ${profile.handle}`}
            onPointerEnter={() => playSound('hover')}
          >
            {variant === 'round' ? (
              <>
                <span className="social-inner">
                  <SocialIcon name={link.icon} className="social-icon" />
                </span>
                <span className="social-handle" aria-hidden="true">
                  {link.handle}
                </span>
              </>
            ) : (
              <>
                <SocialIcon name={link.icon} className="social-icon" />
                <span aria-hidden="true">{link.handle}</span>
                <span className="social-arrow" aria-hidden="true">
                  ↗
                </span>
              </>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

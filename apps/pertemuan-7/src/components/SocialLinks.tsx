import { playSound } from '../audio/sound';
import type { SocialLink } from '../types';

/** Short icon-free monogram for a social network, shown inside the round buttons. */
function monogram(label: string): string {
  const known: Record<string, string> = { youtube: 'yt', instagram: 'ig', behance: 'be', linkedin: 'in', x: 'x', vimeo: 'vi', tiktok: 'tt' };
  return known[label.toLowerCase()] ?? label.slice(0, 2).toLowerCase();
}

interface SocialLinksProps {
  links: SocialLink[];
  /** round: circular buttons (menu); labelled: text links (about). */
  variant: 'round' | 'labelled';
  className?: string;
}

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
            aria-label={variant === 'round' ? link.label : undefined}
            onPointerEnter={() => playSound('hover')}
          >
            {variant === 'round' ? (
              <span className="social-inner" aria-hidden="true">
                {monogram(link.label)}
              </span>
            ) : (
              <>
                <span>{link.label}</span>
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

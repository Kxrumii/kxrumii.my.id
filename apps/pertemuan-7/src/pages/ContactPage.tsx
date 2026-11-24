import { profile } from '../data/profile';
import { Page } from '../components/Page';

export function ContactPage() {
  return (
    <Page name="contact" title="Contact" eyebrow="CONTACT">
      <p className="page-copy">{profile.email}</p>
    </Page>
  );
}

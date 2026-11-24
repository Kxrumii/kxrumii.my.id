import { KIND_LABELS, playgroundItems } from '../data/playground';
import { Page } from '../components/Page';

export function PlaygroundPage() {
  return (
    <Page name="playground" title="Playground" eyebrow="PLAYGROUND">
      <ul className="stub-list">
        {playgroundItems.map((item) => (
          <li key={item.id}>
            <span className="stub-row">
              <span>{item.title}</span>
              <span className="stub-meta">{KIND_LABELS[item.kind]}</span>
            </span>
          </li>
        ))}
      </ul>
    </Page>
  );
}

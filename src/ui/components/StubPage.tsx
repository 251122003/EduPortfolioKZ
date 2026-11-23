import type { ReactElement } from 'react';
import { t } from '../../i18n';
import { PageTitle } from './PageTitle';

interface StubPageProps {
  title: string;
}

/** Placeholder for pages that are not built yet. */
export function StubPage({ title }: StubPageProps): ReactElement {
  return (
    <section className="space-y-4">
      <PageTitle>{title}</PageTitle>
      <p className="text-ink/70">{t.pages.comingSoon}</p>
    </section>
  );
}

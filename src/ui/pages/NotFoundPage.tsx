import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../../i18n';
import { PageTitle } from '../components/PageTitle';

export function NotFoundPage(): ReactElement {
  return (
    <section className="space-y-4">
      <PageTitle>{t.pages.notFound}</PageTitle>
      <p className="text-ink/70">{t.pages.notFoundText}</p>
      <Link to="/" className="font-medium text-primary hover:underline">
        {t.pages.toHome}
      </Link>
    </section>
  );
}

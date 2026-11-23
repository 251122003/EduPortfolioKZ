import type { ReactElement } from 'react';
import { t } from '../../i18n';
import { StubPage } from '../components/StubPage';

export function LoginPage(): ReactElement {
  return <StubPage title={t.pages.login} />;
}

import type { ReactElement } from 'react';
import { t } from '../../i18n';
import { StubPage } from '../components/StubPage';

export function RegisterPage(): ReactElement {
  return <StubPage title={t.pages.register} />;
}

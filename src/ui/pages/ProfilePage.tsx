import type { ReactElement } from 'react';
import { t } from '../../i18n';
import { StubPage } from '../components/StubPage';

export function ProfilePage(): ReactElement {
  return <StubPage title={t.pages.profile} />;
}

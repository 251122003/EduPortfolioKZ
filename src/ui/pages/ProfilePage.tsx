import type { ReactElement } from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '../../i18n';
import { StubPage } from '../components/StubPage';

/** State passed to /me right after registration. */
export interface ProfilePageState {
  guardianConsentRequired: boolean;
}

function needsGuardianConsent(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'guardianConsentRequired' in state &&
    state.guardianConsentRequired === true
  );
}

export function ProfilePage(): ReactElement {
  const location = useLocation();

  return (
    <div className="space-y-6">
      {needsGuardianConsent(location.state) && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          {t.profile.guardianConsent}
        </p>
      )}
      <StubPage title={t.pages.profile} />
    </div>
  );
}

import { type FormEvent, type KeyboardEvent, type ReactElement, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorText, t } from '../../i18n';
import { useSessionStore } from '../../stores/sessionStore';
import type { LoginRequest } from '../../types/api';
import { FormAlert, FormField, SubmitButton } from '../components/FormField';
import { PageTitle } from '../components/PageTitle';

type LoginTab = 'student' | 'staff';
const tabs: LoginTab[] = ['student', 'staff'];

interface LoginErrors {
  login?: string;
  password?: string;
}

const tabLabel: Record<LoginTab, string> = {
  student: t.login.studentTab,
  staff: t.login.staffTab,
};

// FR-25: a student signs in by phone, organization staff and admins by email.
function validate(tab: LoginTab, login: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  if (tab === 'student') {
    const digits = login.replace(/\D/g, '').length;
    if (digits !== 10 && digits !== 11) errors.login = t.register.phoneInvalid;
  } else if (login.trim() === '') {
    errors.login = t.form.required;
  }
  if (password === '') errors.password = t.form.required;
  return errors;
}

function bodyFor(tab: LoginTab, login: string, password: string): LoginRequest {
  return tab === 'student' ? { phone: login.trim(), password } : { login: login.trim(), password };
}

export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const signIn = useSessionStore((state) => state.login);
  const [tab, setTab] = useState<LoginTab>('student');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Blocks a second submit before React re-renders the disabled button.
  const inFlight = useRef(false);

  function selectTab(next: LoginTab): void {
    if (next === tab || inFlight.current) return;
    setTab(next);
    setLogin('');
    setPassword('');
    setErrors({});
    setFormError(null);
  }

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
    selectTab(next);
    document.getElementById(`login-tab-${next}`)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlight.current) return;

    const found = validate(tab, login, password);
    setErrors(found);
    setFormError(null);
    if (found.login !== undefined || found.password !== undefined) {
      document.getElementById(found.login !== undefined ? 'login-login' : 'login-password')?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    const ok = await signIn(bodyFor(tab, login, password));
    if (ok) {
      navigate('/me', { replace: true });
      return;
    }
    // One text for an unknown login and a wrong password (INVALID_CREDENTIALS).
    setFormError(errorText(useSessionStore.getState().error ?? 'UNKNOWN'));
    setPassword('');
    inFlight.current = false;
    setSubmitting(false);
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <PageTitle>{t.pages.login}</PageTitle>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div role="tablist" aria-label={t.login.tabsLabel} className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-page p-1">
          {tabs.map((item) => (
            <button
              key={item}
              id={`login-tab-${item}`}
              type="button"
              role="tab"
              aria-selected={item === tab}
              aria-controls="login-panel"
              tabIndex={item === tab ? 0 : -1}
              onClick={() => selectTab(item)}
              onKeyDown={handleTabKey}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink/70 aria-selected:bg-white aria-selected:text-ink aria-selected:shadow-sm"
            >
              {tabLabel[item]}
            </button>
          ))}
        </div>
        <div id="login-panel" role="tabpanel" aria-labelledby={`login-tab-${tab}`}>
          <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {tab === 'student' ? (
              <FormField
                key="phone"
                id="login-login"
                label={t.login.phone}
                hint={t.login.phoneHint}
                error={errors.login}
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                type="tel"
                autoComplete="tel"
                required
              />
            ) : (
              <FormField
                key="email"
                id="login-login"
                label={t.login.email}
                error={errors.login}
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            )}
            <FormField
              id="login-password"
              label={t.login.password}
              error={errors.password}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
            <FormAlert message={formError} />
            <SubmitButton busy={submitting}>{t.login.submit}</SubmitButton>
          </form>
        </div>
      </div>
      <p className="text-center text-sm text-ink/70">
        {t.login.noAccount}{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          {t.login.toRegister}
        </Link>
      </p>
    </section>
  );
}

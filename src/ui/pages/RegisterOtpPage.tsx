import { type FormEvent, type ReactElement, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resendOtp, verifyOtp } from '../../api/auth';
import { ApiError } from '../../api/http';
import { errorText, t } from '../../i18n';
import { useSessionStore } from '../../stores/sessionStore';
import { FormAlert, FormField, SubmitButton } from '../components/FormField';
import { PageTitle } from '../components/PageTitle';
import type { ProfilePageState } from './ProfilePage';

/** NFR-7: one SMS per phone per 60 seconds. */
export const RESEND_DELAY_SECONDS = 60;

/** Reads the otpId that /register put into the router state. */
function otpIdFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('otpId' in state)) return null;
  return typeof state.otpId === 'string' && state.otpId !== '' ? state.otpId : null;
}

/** Text for a failed verify or resend, chosen by the error code. */
function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return errorText('UNKNOWN');
  if (error.code === 'OTP_INVALID' && error.attemptsLeft !== undefined) {
    return t.otp.attemptsLeft(error.attemptsLeft);
  }
  return errorText(error.code);
}

export function RegisterOtpPage(): ReactElement {
  const location = useLocation();
  const initialOtpId = otpIdFrom(location.state);

  if (initialOtpId === null) {
    return (
      <section className="mx-auto max-w-md space-y-6">
        <PageTitle>{t.pages.registerOtp}</PageTitle>
        <p className="text-ink/70">{t.otp.noOtp}</p>
        <Link to="/register" className="inline-block font-medium text-primary hover:underline">
          {t.otp.restart}
        </Link>
      </section>
    );
  }
  return <OtpForm initialOtpId={initialOtpId} />;
}

function OtpForm({ initialOtpId }: { initialOtpId: string }): ReactElement {
  const navigate = useNavigate();
  const loadMe = useSessionStore((state) => state.loadMe);
  const [otpId, setOtpId] = useState(initialOtpId);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_DELAY_SECONDS);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  // Blocks a second request before React re-renders the disabled buttons.
  const inFlight = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function start(): boolean {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setFormError(null);
    setInfo(null);
    return true;
  }

  function finish(): void {
    inFlight.current = false;
    setBusy(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlight.current || locked) return;
    if (!/^\d{6}$/.test(code)) {
      setCodeError(t.otp.codeInvalid);
      document.getElementById('otp-code')?.focus();
      return;
    }
    setCodeError(null);
    if (!start()) return;

    try {
      const result = await verifyOtp({ otpId, code });
      // verify-otp has set the session cookie; load the user before opening /me.
      await loadMe();
      const state: ProfilePageState = { guardianConsentRequired: result.guardianConsentRequired };
      navigate('/me', { state });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'OTP_LOCKED') setLocked(true);
      setFormError(messageFor(error));
      finish();
    }
  }

  async function handleResend(): Promise<void> {
    if (secondsLeft > 0 || !start()) return;
    try {
      const result = await resendOtp({ otpId });
      setOtpId(result.otpId);
      setCode('');
      setCodeError(null);
      setLocked(false);
      setInfo(t.otp.resent);
      setSecondsLeft(RESEND_DELAY_SECONDS);
    } catch (error) {
      setFormError(messageFor(error));
    } finally {
      finish();
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <PageTitle>{t.pages.registerOtp}</PageTitle>
      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <p className="text-ink/70">{t.otp.intro}</p>
        <FormField
          id="otp-code"
          label={t.otp.code}
          hint={t.otp.codeHint}
          error={codeError}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          disabled={locked}
          required
        />
        <FormAlert message={formError} />
        {info && (
          <p role="status" className="text-sm text-green-800">
            {info}
          </p>
        )}
        <SubmitButton busy={busy} disabled={locked}>
          {t.otp.submit}
        </SubmitButton>
        <div className="space-y-1 text-center">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={busy || secondsLeft > 0}
            className="font-medium text-primary hover:underline disabled:text-ink/40 disabled:no-underline"
          >
            {t.otp.resend}
          </button>
          {secondsLeft > 0 && <p className="text-sm text-ink/60">{t.otp.resendIn(secondsLeft)}</p>}
        </div>
      </form>
    </section>
  );
}

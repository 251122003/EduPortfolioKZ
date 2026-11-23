import { type FormEvent, type ReactElement, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerStudent } from '../../api/auth';
import { ApiError } from '../../api/http';
import { errorText, t } from '../../i18n';
import { CheckboxField, FormAlert, FormField, SubmitButton } from '../components/FormField';
import { PageTitle } from '../components/PageTitle';

interface RegisterValues {
  iin: string;
  lastName: string;
  firstName: string;
  middleName: string;
  phone: string;
  password: string;
  consent: boolean;
}

type TextField = Exclude<keyof RegisterValues, 'consent'>;
type FieldErrors = Partial<Record<keyof RegisterValues, string>>;

/** Fields in screen order, so the first invalid one gets the focus. */
const fieldOrder: (keyof RegisterValues)[] = [
  'iin',
  'lastName',
  'firstName',
  'middleName',
  'phone',
  'password',
  'consent',
];

const emptyValues: RegisterValues = {
  iin: '',
  lastName: '',
  firstName: '',
  middleName: '',
  phone: '',
  password: '',
  consent: false,
};

/** State passed to /register/otp. Only the otpId: never IIN or phone. */
export interface OtpPageState {
  otpId: string;
}

// Format checks only. The IIN check digit, birth date and phone operator are checked by the server.
function validate(values: RegisterValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^\d{12}$/.test(values.iin.trim())) errors.iin = t.register.iinInvalid;
  if (values.lastName.trim() === '') errors.lastName = t.form.required;
  if (values.firstName.trim() === '') errors.firstName = t.form.required;
  const phoneDigits = values.phone.replace(/\D/g, '').length;
  if (phoneDigits !== 10 && phoneDigits !== 11) errors.phone = t.register.phoneInvalid;
  if (values.password.length < 8) errors.password = t.register.passwordTooShort;
  if (!values.consent) errors.consent = t.register.consentRequired;
  return errors;
}

/** The server takes one fullName: "Last First Middle", the middle name only when given. */
function fullNameOf(values: RegisterValues): string {
  return [values.lastName, values.firstName, values.middleName]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(' ');
}

const fieldId = (field: keyof RegisterValues): string => `register-${field}`;

export function RegisterPage(): ReactElement {
  const navigate = useNavigate();
  const [values, setValues] = useState<RegisterValues>(emptyValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Blocks a second submit before React re-renders the disabled button.
  const inFlight = useRef(false);

  function setText(field: TextField) {
    return (event: { target: { value: string } }): void => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlight.current) return;

    const errors = validate(values);
    setFieldErrors(errors);
    setFormError(null);
    const firstInvalid = fieldOrder.find((field) => errors[field] !== undefined);
    if (firstInvalid !== undefined) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const { otpId } = await registerStudent({
        iin: values.iin.trim(),
        fullName: fullNameOf(values),
        phone: values.phone.trim(),
        password: values.password,
        locale: 'ru',
      });
      const state: OtpPageState = { otpId };
      navigate('/register/otp', { state });
    } catch (error) {
      setFormError(errorText(error instanceof ApiError ? error.code : 'UNKNOWN'));
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <PageTitle>{t.pages.register}</PageTitle>
      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <FormField
          id={fieldId('iin')}
          label={t.register.iin}
          hint={t.register.iinHint}
          error={fieldErrors.iin}
          value={values.iin}
          onChange={setText('iin')}
          inputMode="numeric"
          maxLength={12}
          autoComplete="off"
          required
        />
        <FormField
          id={fieldId('lastName')}
          label={t.register.lastName}
          hint={t.register.nameHint}
          error={fieldErrors.lastName}
          value={values.lastName}
          onChange={setText('lastName')}
          autoComplete="family-name"
          required
        />
        <FormField
          id={fieldId('firstName')}
          label={t.register.firstName}
          error={fieldErrors.firstName}
          value={values.firstName}
          onChange={setText('firstName')}
          autoComplete="given-name"
          required
        />
        <FormField
          id={fieldId('middleName')}
          label={t.register.middleName}
          hint={t.register.middleNameHint}
          value={values.middleName}
          onChange={setText('middleName')}
          autoComplete="additional-name"
        />
        <FormField
          id={fieldId('phone')}
          label={t.register.phone}
          hint={t.register.phoneHint}
          error={fieldErrors.phone}
          value={values.phone}
          onChange={setText('phone')}
          type="tel"
          autoComplete="tel"
          required
        />
        <FormField
          id={fieldId('password')}
          label={t.register.password}
          hint={t.register.passwordHint}
          error={fieldErrors.password}
          value={values.password}
          onChange={setText('password')}
          type="password"
          autoComplete="new-password"
          required
        />
        <CheckboxField
          id={fieldId('consent')}
          label={t.register.consent}
          error={fieldErrors.consent}
          checked={values.consent}
          onChange={(event) => {
            const consent = event.target.checked;
            setValues((current) => ({ ...current, consent }));
          }}
          required
        />
        <FormAlert message={formError} />
        <SubmitButton busy={submitting}>{t.register.submit}</SubmitButton>
      </form>
      <p className="text-center text-sm text-ink/70">
        {t.register.haveAccount}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t.register.toLogin}
        </Link>
      </p>
    </section>
  );
}

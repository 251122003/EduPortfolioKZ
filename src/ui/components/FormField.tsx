import type { ComponentPropsWithoutRef, ReactElement } from 'react';

type InputProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'id' | 'aria-describedby' | 'aria-invalid' | 'className'
>;

interface FieldProps extends InputProps {
  id: string;
  label: string;
  hint?: string;
  /** Error text for this field; linked to the input through aria-describedby. */
  error?: string | null;
}

/** ids of the hint and error, so screen readers read them with the input. */
function describedBy(id: string, hint: string | undefined, error: string | null | undefined): string | undefined {
  const ids: string[] = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function FieldError({ id, error }: { id: string; error: string | null | undefined }): ReactElement | null {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="text-sm text-red-700">
      {error}
    </p>
  );
}

/** Text input with a label, an optional hint and an error under it. */
export function FormField({ id, label, hint, error, ...inputProps }: FieldProps): ReactElement {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 aria-invalid:border-red-700 disabled:bg-ink/5"
        {...inputProps}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink/60">
          {hint}
        </p>
      )}
      <FieldError id={id} error={error} />
    </div>
  );
}

/** Checkbox with the label on the right and an error under it. */
export function CheckboxField({ id, label, error, ...inputProps }: Omit<FieldProps, 'hint'>): ReactElement {
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, undefined, error)}
          className="mt-1 size-4 accent-primary"
          {...inputProps}
        />
        <label htmlFor={id} className="text-sm text-ink">
          {label}
        </label>
      </div>
      <FieldError id={id} error={error} />
    </div>
  );
}

/** Error of the whole form, e.g. from the server. Announced at once by screen readers. */
export function FormAlert({ message }: { message: string | null }): ReactElement | null {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

/** Primary submit button; disabled while the request runs so it cannot be sent twice. */
export function SubmitButton({
  busy,
  disabled,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  children: string;
}): ReactElement {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
    >
      {children}
    </button>
  );
}

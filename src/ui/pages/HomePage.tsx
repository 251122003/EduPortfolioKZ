import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../../i18n';

export function HomePage(): ReactElement {
  return (
    <div className="space-y-16">
      <section className="space-y-6 py-6">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          {t.home.title}
        </h1>
        <p className="max-w-2xl text-lg text-ink/70">{t.home.subtitle}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/register"
            className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
          >
            {t.home.register}
          </Link>
          <a
            href="#how-it-works"
            className="rounded-lg border border-primary px-6 py-3 font-medium text-primary hover:bg-primary/5"
          >
            {t.home.verify}
          </a>
        </div>
      </section>

      <section aria-labelledby="audience-title" className="space-y-6">
        <h2 id="audience-title" className="text-2xl font-semibold text-ink">
          {t.home.audienceTitle}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {t.home.audience.map((item) => (
            <li key={item.title} className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-2 font-semibold text-ink">{item.title}</h3>
              <p className="text-sm text-ink/70">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-6 space-y-6">
        <h2 id="how-title" className="text-2xl font-semibold text-ink">
          {t.home.howTitle}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {t.home.steps.map((step, index) => (
            <li key={step.title} className="rounded-xl bg-white p-6 shadow-sm">
              <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mb-2 font-semibold text-ink">{step.title}</h3>
              <p className="text-sm text-ink/70">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

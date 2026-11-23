import type { ReactElement } from 'react';

interface PageTitleProps {
  children: string;
}

export function PageTitle({ children }: PageTitleProps): ReactElement {
  return <h1 className="text-3xl font-bold tracking-tight text-ink">{children}</h1>;
}

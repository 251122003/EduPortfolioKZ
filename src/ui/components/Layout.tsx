import type { ReactElement, ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

interface LayoutProps {
  header: ReactNode;
}

export function Layout({ header }: LayoutProps): ReactElement {
  return (
    <div className="flex min-h-svh flex-col">
      {header}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}

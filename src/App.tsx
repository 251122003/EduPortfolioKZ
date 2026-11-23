import { useEffect, type ReactElement } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './router';
import { useSessionStore } from './stores/sessionStore';

const router = createBrowserRouter(routes);

export function App(): ReactElement {
  const loadMe = useSessionStore((state) => state.loadMe);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  return <RouterProvider router={router} />;
}

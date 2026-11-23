import type { RouteObject } from 'react-router-dom';
import { Layout } from './ui/components/Layout';
import { HeaderContainer } from './ui/containers/HeaderContainer';
import { RequireAuth } from './ui/containers/RequireAuth';
import { HomePage } from './ui/pages/HomePage';
import { LoginPage } from './ui/pages/LoginPage';
import { NotFoundPage } from './ui/pages/NotFoundPage';
import { ProfilePage } from './ui/pages/ProfilePage';
import { RegisterOtpPage } from './ui/pages/RegisterOtpPage';
import { RegisterPage } from './ui/pages/RegisterPage';
import { VerifyPage } from './ui/pages/VerifyPage';

export const routes: RouteObject[] = [
  {
    element: <Layout header={<HeaderContainer />} />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/register/otp', element: <RegisterOtpPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/v/:token', element: <VerifyPage /> },
      {
        element: <RequireAuth />,
        children: [{ path: '/me', element: <ProfilePage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

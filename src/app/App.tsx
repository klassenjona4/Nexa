import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ToastProvider } from '../components/Toast';
import { AuthCallback, AuthConfirm } from '../screens/auth/AuthConfirm';
import { SignIn } from '../screens/auth/SignIn';
import { Welcome } from '../screens/auth/Welcome';
import { Placeholder } from '../screens/Placeholder';
import { Landing } from '../screens/public/Landing';
import { AuthProvider } from './AuthProvider';
import { RequireAuth } from './RequireAuth';
import { AppShell, PublicShell } from './Shell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

const router = createBrowserRouter([
  {
    element: <PublicShell />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/sign-in', element: <SignIn /> },
      { path: '/auth/confirm', element: <AuthConfirm /> },
      { path: '/auth/callback', element: <AuthCallback /> },
    ],
  },
  {
    element: <PublicShell showSignIn={false} />,
    children: [{ element: <RequireAuth allowWithoutName />, children: [{ path: '/welcome', element: <Welcome /> }] }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/projects', element: <Placeholder title="Your projects" /> },
          { path: '/account', element: <Placeholder title="Account settings" /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

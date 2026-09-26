import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ToastProvider } from '../components/Toast';
import { AuthCallback, AuthConfirm } from '../screens/auth/AuthConfirm';
import { Board } from '../screens/board/Board';
import { Brief } from '../screens/brief/Brief';
import { Proposal } from '../screens/brief/Proposal';
import { TaskDetail } from '../screens/board/TaskDetail';
import { SignIn } from '../screens/auth/SignIn';
import { Welcome } from '../screens/auth/Welcome';
import { Placeholder } from '../screens/Placeholder';
import { CreateProject } from '../screens/projects/CreateProject';
import { Dashboard } from '../screens/projects/Dashboard';
import { GroupSettings } from '../screens/projects/GroupSettings';
import { Invite } from '../screens/projects/Invite';
import { ProjectLayout } from '../screens/projects/ProjectLayout';
import { Join, JoinAccept, JoinEntry } from '../screens/public/Join';
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
      { path: '/join', element: <JoinEntry /> },
      { path: '/join/:code', element: <Join /> },
    ],
  },
  {
    element: <PublicShell showSignIn={false} />,
    children: [
      { element: <RequireAuth allowWithoutName />, children: [{ path: '/welcome', element: <Welcome /> }] },
      { element: <RequireAuth />, children: [{ path: '/join/:code/accept', element: <JoinAccept /> }] },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/projects', element: <Dashboard /> },
          { path: '/projects/new', element: <CreateProject /> },
          {
            path: '/p/:projectId',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <Navigate to="board" replace /> },
              { path: 'board', element: <Board /> },
              { path: 'tasks/:taskId', element: <TaskDetail /> },
              { path: 'brief', element: <Brief /> },
              { path: 'proposal', element: <Proposal /> },
              { path: 'log', element: <Placeholder title="Contribution log" /> },
              { path: 'statement', element: <Placeholder title="Contribution statement" /> },
              { path: 'invite', element: <Invite /> },
              { path: 'calendar', element: <Placeholder title="Calendar feed" /> },
              { path: 'settings', element: <GroupSettings /> },
            ],
          },
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

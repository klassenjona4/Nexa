import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingState } from '../components/States';
import p from './page.module.css';
import { useAuth } from './AuthProvider';

export function RequireAuth({ allowWithoutName = false }: { allowWithoutName?: boolean }) {
  const { ready, session, profile, profileLoading } = useAuth();
  const location = useLocation();
  const here = location.pathname + location.search;

  if (!ready || (session && profileLoading)) {
    return (
      <div className={p.content}>
        <LoadingState text="Loading" />
      </div>
    );
  }
  if (!session) return <Navigate to={`/sign-in?next=${encodeURIComponent(here)}`} replace />;
  if (!allowWithoutName && profile && profile.full_name.trim() === '') {
    return <Navigate to={`/welcome?next=${encodeURIComponent(here)}`} replace />;
  }
  return <Outlet />;
}

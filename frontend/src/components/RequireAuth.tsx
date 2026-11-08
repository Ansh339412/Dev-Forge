import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { RealtimeProvider } from '../lib/realtime';
import { useAuth } from '../stores/auth';
import { Spinner } from './ui';

export default function RequireAuth() {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const bootstrap = useAuth((s) => s.bootstrap);
  const location = useLocation();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!ready) return <Spinner label="Signing you in" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <RealtimeProvider>
      <Outlet />
    </RealtimeProvider>
  );
}

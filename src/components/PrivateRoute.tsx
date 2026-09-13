import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface PrivateRouteProps {
  children: React.ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    // Mémorise la page demandée (ex. /partager?text=…) pour y revenir après connexion
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

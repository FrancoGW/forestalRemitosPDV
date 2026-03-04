import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  rol?: 'superadmin' | 'pdv';
}

export default function ProtectedRoute({ children, rol }: Props) {
  const { usuario } = useAuth();

  if (!usuario) return <Navigate to="/login" replace />;
  if (rol && usuario.rol !== rol) {
    return <Navigate to={usuario.rol === 'superadmin' ? '/admin' : '/pdv'} replace />;
  }

  return <>{children}</>;
}

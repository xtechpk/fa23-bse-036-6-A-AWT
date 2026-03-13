import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { UserRole } from '../types/auth.types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuthStore();

  // 1. Check if User is Logged In
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Check Role Access (RBAC)
  if (allowedRoles && !allowedRoles.includes(user.role)) {

    return <Navigate to="/" replace />; 
  }

  // 3. Render the protected page
  return <Outlet />;
};

export default ProtectedRoute;
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// <ProtectedRoute> requires login; <ProtectedRoute admin> also requires the admin role
export default function ProtectedRoute({ admin = false, children }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

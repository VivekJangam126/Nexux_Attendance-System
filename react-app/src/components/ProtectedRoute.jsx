import { Navigate } from 'react-router-dom';
import Auth, { RoutePaths, PageType } from '../services/auth';

/**
 * ProtectedRoute Component
 * 
 * Matches the behavior of Auth.guardPage() from the original implementation.
 * 
 * Props:
 * - children: The page component to render if access is granted
 * - pageType: The PageType to check access for
 * 
 * Behavior:
 * - If not logged in: redirect to login
 * - If logged in but wrong role: redirect to default page for role
 * - If logged in with correct role: render children
 */
function ProtectedRoute({ children, pageType }) {
  const isLoggedIn = Auth.isLoggedIn();
  const canAccess = Auth.canAccessPage(pageType);

  // Special handling for Login page
  if (pageType === PageType.LOGIN) {
    // If already logged in, redirect to default page
    if (isLoggedIn) {
      console.log('[ProtectedRoute] Already logged in, redirecting to default page');
      return <Navigate to={Auth.getDefaultRoute()} replace />;
    }
    // Not logged in, show login page
    return children;
  }

  // For all other pages
  if (!isLoggedIn) {
    console.log('[ProtectedRoute] Not logged in, redirecting to login');
    return <Navigate to={RoutePaths.LOGIN} replace />;
  }

  if (!canAccess) {
    console.log('[ProtectedRoute] Access denied, redirecting to default page');
    return <Navigate to={Auth.getDefaultRoute()} replace />;
  }

  // Access granted
  return children;
}

export default ProtectedRoute;

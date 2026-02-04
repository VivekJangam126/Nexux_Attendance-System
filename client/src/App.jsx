import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { PageType, RoutePaths } from './services/auth';

// Pages
import Login from './pages/Login';
import MarkAttendance from './pages/MarkAttendance';
import Confirmation from './pages/Confirmation';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Reports from './pages/Reports';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login - redirects to default page if already logged in */}
        <Route
          path={RoutePaths.LOGIN}
          element={
            <ProtectedRoute pageType={PageType.LOGIN}>
              <Login />
            </ProtectedRoute>
          }
        />

        {/* Employee Pages */}
        <Route
          path={RoutePaths.MARK_ATTENDANCE}
          element={
            <ProtectedRoute pageType={PageType.MARK_ATTENDANCE}>
              <MarkAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path={RoutePaths.CONFIRMATION}
          element={
            <ProtectedRoute pageType={PageType.CONFIRMATION}>
              <Confirmation />
            </ProtectedRoute>
          }
        />

        {/* Admin/Management Pages */}
        <Route
          path={RoutePaths.DASHBOARD}
          element={
            <ProtectedRoute pageType={PageType.DASHBOARD}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={RoutePaths.REPORTS}
          element={
            <ProtectedRoute pageType={PageType.REPORTS}>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* Admin Only Pages */}
        <Route
          path={RoutePaths.SETTINGS}
          element={
            <ProtectedRoute pageType={PageType.SETTINGS}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Catch-all: redirect to login */}
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

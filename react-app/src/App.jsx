import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { PageType, RoutePaths } from './services/auth';

// Pages
import Login from './pages/Login';

// Placeholder pages (to be implemented)
const MarkAttendance = () => <div className="p-8">Mark Attendance Page - Coming Soon</div>;
const Confirmation = () => <div className="p-8">Confirmation Page - Coming Soon</div>;
const Dashboard = () => <div className="p-8">Dashboard Page - Coming Soon</div>;
const Settings = () => <div className="p-8">Settings Page - Coming Soon</div>;
const Reports = () => <div className="p-8">Reports Page - Coming Soon</div>;

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

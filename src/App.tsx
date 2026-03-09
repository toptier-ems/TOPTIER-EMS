import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import LeavePage from './pages/LeavePage';
import LeaveRequestsPage from './pages/LeaveRequestsPage';
import FeedPage from './pages/FeedPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import EmployeeApprovalPage from './pages/EmployeeApprovalPage';
import MeetingsPage from './pages/MeetingsPage';
import LeaveAllocationPage from './pages/LeaveAllocationPage';
import SettingsPage from './pages/SettingsPage';
import TotalEmployeesPage from './pages/TotalEmployeesPage';
import RecruitmentPage from './pages/RecruitmentPage';
import ActionLogPage from './pages/ActionLogPage';
import ClientsITDepartmentPage from './pages/ClientsITDepartmentPage';
import TeamCalendarPage from './pages/TeamCalendarPage';
import ProfessionalDevelopmentPage from './pages/ProfessionalDevelopmentPage';
import CertificatePage from './pages/CertificatePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-toptier-muted">Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (profile && profile.approval_status !== 'approved') return <PendingApprovalPage />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:userId"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <Layout>
              <FeedPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave"
        element={
          <ProtectedRoute>
            <Layout>
              <LeavePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave/requests"
        element={
          <ProtectedRoute>
            <Layout>
              <LeaveRequestsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave/allocation"
        element={
          <ProtectedRoute>
            <Layout>
              <LeaveAllocationPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/meetings"
        element={
          <ProtectedRoute>
            <Layout>
              <MeetingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee-approval"
        element={
          <ProtectedRoute>
            <Layout>
              <EmployeeApprovalPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <Layout>
              <TotalEmployeesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruitment"
        element={
          <ProtectedRoute>
            <Layout>
              <RecruitmentPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/action-log"
        element={
          <ProtectedRoute>
            <Layout>
              <ActionLogPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients-it-department"
        element={
          <ProtectedRoute>
            <Layout>
              <ClientsITDepartmentPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/team-calendar"
        element={
          <ProtectedRoute>
            <Layout>
              <TeamCalendarPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/professional-development"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfessionalDevelopmentPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/certificate/:id"
        element={
          <ProtectedRoute>
            <CertificatePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

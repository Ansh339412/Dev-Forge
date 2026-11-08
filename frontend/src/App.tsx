import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { AuthLayout } from './components/AuthLayout';
import RequireAuth from './components/RequireAuth';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from './pages/AuthPages';
import DashboardPage from './pages/DashboardPage';
import AccountPage from './pages/AccountPage';
import MembersPage from './pages/MembersPage';
import ProjectActivityPage from './pages/ProjectActivityPage';
import ProjectBoardPage from './pages/ProjectBoardPage';
import ProjectGithubPage from './pages/ProjectGithubPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import ProjectsPage from './pages/ProjectsPage';
import { AcceptInvitationPage, HomeRedirect, WorkspacesPage } from './pages/WorkspacePages';

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route index element={<HomeRedirect />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/invitations/accept" element={<AcceptInvitationPage />} />
        <Route path="/w/:workspaceId" element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectBoardPage />} />
          <Route path="projects/:projectId/activity" element={<ProjectActivityPage />} />
          <Route path="projects/:projectId/github" element={<ProjectGithubPage />} />
          <Route path="projects/:projectId/settings" element={<ProjectSettingsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

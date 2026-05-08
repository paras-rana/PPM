import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import './App.css';
import { useAuth } from './auth/useAuth';
import CurrentProjectsPage from './pages/CurrentProjectsPage';
import AnnualOperationalInitiativesPage from './pages/AnnualOperationalInitiativesPage';
import CreateAnnualOperationalInitiativePage from './pages/CreateAnnualOperationalInitiativePage';
import CreateStrategicPriorityPeriodPage from './pages/CreateStrategicPriorityPeriodPage';
import FutureProjectsPage from './pages/FutureProjectsPage';
import LoginPage from './pages/LoginPage';
import PortfolioDashboardPage from './pages/PortfolioDashboardPage';
import PortfolioRegisterPage from './pages/PortfolioRegisterPage';
import ProposalReviewPage from './pages/ProposalReviewPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import OperationalInitiativeRegisterPage from './pages/OperationalInitiativeRegisterPage';
import OperationalInitiativeDetailPage from './pages/OperationalInitiativeDetailPage';
import StrategicPriorityPeriodRegisterPage from './pages/StrategicPriorityPeriodRegisterPage';
import StrategicPrioritiesPage from './pages/StrategicPrioritiesPage';
import SubmissionReviewPage from './pages/SubmissionReviewPage';
import SubmitProjectPage from './pages/SubmitProjectPage';
import UserManagementPage from './pages/UserManagementPage';
import RoleDefinitionPage from './pages/RoleDefinitionPage';

function RequireAuth({ children, requiredPermissions = null, requiredAnyPermissions = null }) {
  const { authReady, isAuthenticated, hasPermissions, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return <div className="app-loading">Checking session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredPermissions && !hasPermissions(requiredPermissions)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredAnyPermissions && !hasAnyPermission(requiredAnyPermissions)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={(
            <RequireAuth requiredAnyPermissions={['view_portfolio_dashboard_all', 'view_portfolio_dashboard_owned']}>
              <PortfolioDashboardPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/current"
          element={(
            <RequireAuth requiredAnyPermissions={['view_all_projects', 'view_owned_projects']}>
              <CurrentProjectsPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/operational-initiatives"
          element={(
            <RequireAuth requiredAnyPermissions={['view_all_initiatives', 'view_owned_initiatives']}>
              <AnnualOperationalInitiativesPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/operational-initiatives/new"
          element={(
            <RequireAuth requiredPermissions={['add_initiatives']}>
              <CreateAnnualOperationalInitiativePage />
            </RequireAuth>
          )}
        />
        <Route
          path="/operational-initiatives/register"
          element={(
            <RequireAuth requiredAnyPermissions={['view_all_initiatives', 'view_owned_initiatives']}>
              <OperationalInitiativeRegisterPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/operational-initiatives/:initiativeId"
          element={(
            <RequireAuth requiredAnyPermissions={['view_all_initiatives', 'view_owned_initiatives']}>
              <OperationalInitiativeDetailPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/register"
          element={(
            <RequireAuth requiredAnyPermissions={['view_all_projects', 'view_owned_projects']}>
              <PortfolioRegisterPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/:projectId"
          element={(
            <RequireAuth requiredAnyPermissions={['view_all_projects', 'view_owned_projects']}>
              <ProjectDetailPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/future"
          element={(
            <RequireAuth requiredAnyPermissions={['view_all_projects', 'view_owned_projects', 'review_proposals']}>
              <FutureProjectsPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/submit"
          element={(
            <RequireAuth requiredPermissions={['submit_projects']}>
              <SubmitProjectPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/review"
          element={(
            <RequireAuth requiredPermissions={['review_proposals']}>
              <SubmissionReviewPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/review/:projectId"
          element={(
            <RequireAuth requiredPermissions={['review_proposals']}>
              <ProposalReviewPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/strategic-priorities"
          element={(
            <RequireAuth requiredPermissions={['view_strategies']}>
              <StrategicPrioritiesPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/strategic-priorities/register"
          element={(
            <RequireAuth requiredPermissions={['view_strategies']}>
              <StrategicPriorityPeriodRegisterPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/strategic-priorities/new"
          element={(
            <RequireAuth requiredPermissions={['add_strategies']}>
              <CreateStrategicPriorityPeriodPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/admin/users"
          element={(
            <RequireAuth requiredPermissions={['manage_users']}>
              <UserManagementPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/admin/users/roles"
          element={(
            <RequireAuth requiredPermissions={['manage_users']}>
              <RoleDefinitionPage />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

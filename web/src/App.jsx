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

function RequireAuth({ children }) {
  const { authReady, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return <div className="app-loading">Checking session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
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
            <RequireAuth>
              <PortfolioDashboardPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/current"
          element={(
            <RequireAuth>
              <CurrentProjectsPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/operational-initiatives"
          element={(
            <RequireAuth>
              <AnnualOperationalInitiativesPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/operational-initiatives/new"
          element={(
            <RequireAuth>
              <CreateAnnualOperationalInitiativePage />
            </RequireAuth>
          )}
        />
        <Route
          path="/operational-initiatives/register"
          element={(
            <RequireAuth>
              <OperationalInitiativeRegisterPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/operational-initiatives/:initiativeId"
          element={(
            <RequireAuth>
              <OperationalInitiativeDetailPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/register"
          element={(
            <RequireAuth>
              <PortfolioRegisterPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/:projectId"
          element={(
            <RequireAuth>
              <ProjectDetailPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/future"
          element={(
            <RequireAuth>
              <FutureProjectsPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/submit"
          element={(
            <RequireAuth>
              <SubmitProjectPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/review"
          element={(
            <RequireAuth>
              <SubmissionReviewPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/review/:projectId"
          element={(
            <RequireAuth>
              <ProposalReviewPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/strategic-priorities"
          element={(
            <RequireAuth>
              <StrategicPrioritiesPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/strategic-priorities/register"
          element={(
            <RequireAuth>
              <StrategicPriorityPeriodRegisterPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/strategic-priorities/new"
          element={(
            <RequireAuth>
              <CreateStrategicPriorityPeriodPage />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

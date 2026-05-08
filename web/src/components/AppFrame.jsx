import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import Icon from './Icon';

const SECTION_BAND_CLASSES = [
  'band-purple',
  'band-orange',
  'band-green',
  'band-blue',
  'band-red',
];

function hasBandTarget(className = '') {
  const classNames = className.split(/\s+/).filter(Boolean);
  return classNames.includes('panel') || classNames.includes('detail-section-banded');
}

function applySectionBands(node, state) {
  if (!isValidElement(node)) {
    return node;
  }

  // We preserve the original element tree and only inject alternating band classes
  // into known section containers.
  const nextProps = {};
  const className = typeof node.props.className === 'string' ? node.props.className : '';

  if (hasBandTarget(className)) {
    const bandClass = SECTION_BAND_CLASSES[state.index % SECTION_BAND_CLASSES.length];
    state.index += 1;
    nextProps.className = `${className} ${bandClass}`.trim();
  }

  if (node.props.children) {
    nextProps.children = Children.map(node.props.children, (child) => applySectionBands(child, state));
  }

  return Object.keys(nextProps).length > 0 ? cloneElement(node, nextProps) : node;
}

export default function AppFrame({
  title,
  description,
  children,
  detailLabel = null,
  topNavActions = null,
}) {
  const {
    user,
    logout,
    canAddInitiatives,
    canManageUsers,
    canReviewProposals,
    canSubmitProjects,
    canViewInitiatives,
    canViewPortfolioDashboard,
    canViewProjects,
    canViewStrategies,
  } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const bandedChildren = useMemo(() => {
    // The recursive banding pass only depends on the rendered content tree.
    const bandState = { index: 1 };
    return Children.map(children, (child) => applySectionBands(child, bandState));
  }, [children]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <div className="app-layout">
        <aside className="side-nav">
          <nav className="side-nav-links" aria-label="Primary navigation">
            {canViewPortfolioDashboard ? (
              <NavLink
                end
                className={({ isActive }) => `nav-link side-nav-link band-purple ${isActive ? 'active' : ''}`}
                to="/dashboard"
                aria-label="Portfolio Dashboard"
                data-label="Portfolio Dashboard"
              >
                <Icon name="dashboard" />
                <span className="side-nav-link-label">Portfolio Dashboard</span>
              </NavLink>
            ) : null}
            {canViewProjects ? (
              <>
                <NavLink
                  end
                  className={({ isActive }) => `nav-link side-nav-link band-orange ${isActive ? 'active' : ''}`}
                  to="/projects/current"
                  aria-label="Current Projects"
                  data-label="Current Projects"
                >
                  <Icon name="dashboard" />
                  <span className="side-nav-link-label">Current Projects</span>
                </NavLink>
                <NavLink
                  end
                  className={({ isActive }) => `nav-link side-nav-link band-green ${isActive ? 'active' : ''}`}
                  to="/projects/future"
                  aria-label="Future Projects"
                  data-label="Future Projects"
                >
                  <Icon name="portfolio" />
                  <span className="side-nav-link-label">Future Projects</span>
                </NavLink>
                <NavLink
                  end
                  className={({ isActive }) => `nav-link side-nav-link band-blue ${isActive ? 'active' : ''}`}
                  to="/projects/register"
                  aria-label="Portfolio Register"
                  data-label="Portfolio Register"
                >
                  <Icon name="register" />
                  <span className="side-nav-link-label">Portfolio Register</span>
                </NavLink>
              </>
            ) : null}
            {canSubmitProjects ? (
              <NavLink
                end
                className={({ isActive }) => `nav-link side-nav-link band-purple ${isActive ? 'active' : ''}`}
                to="/projects/submit"
                aria-label="Submit Project"
                data-label="Submit Project"
              >
                <Icon name="plus" />
                <span className="side-nav-link-label">Submit Project</span>
              </NavLink>
            ) : null}
            {canReviewProposals ? (
              <NavLink
                end
                className={({ isActive }) => `nav-link side-nav-link band-red ${isActive ? 'active' : ''}`}
                to="/projects/review"
                aria-label="Review Queue"
                data-label="Review Queue"
              >
                <Icon name="review" />
                <span className="side-nav-link-label">Review Queue</span>
              </NavLink>
            ) : null}
            {canViewStrategies ? (
              <NavLink
                end
                className={({ isActive }) => `nav-link side-nav-link band-purple ${isActive ? 'active' : ''}`}
                to="/strategic-priorities"
                aria-label="Strategic Priorities"
                data-label="Strategic Priorities"
              >
                <Icon name="assessment" />
                <span className="side-nav-link-label">Strategic Priorities</span>
              </NavLink>
            ) : null}
            {canViewInitiatives ? (
              <NavLink
                end
                className={({ isActive }) => `nav-link side-nav-link band-orange ${isActive ? 'active' : ''}`}
                to="/operational-initiatives"
                aria-label="Annual Operational Initiatives"
                data-label="Annual Operational Initiatives"
              >
                <Icon name="portfolio" />
                <span className="side-nav-link-label">Annual Operational Initiatives</span>
              </NavLink>
            ) : null}
            {canAddInitiatives ? (
              <NavLink
                end
                className={({ isActive }) => `nav-link side-nav-link band-green ${isActive ? 'active' : ''}`}
                to="/operational-initiatives/new"
                aria-label="Add Annual Operational Initiative"
                data-label="Add Annual Operational Initiative"
              >
                <Icon name="plus" />
                <span className="side-nav-link-label">Add Annual Operational Initiative</span>
              </NavLink>
            ) : null}
            {canManageUsers ? (
              <NavLink
                end
                className={({ isActive }) => `nav-link side-nav-link band-red ${isActive ? 'active' : ''}`}
                to="/admin/users"
                aria-label="User Management"
                data-label="User Management"
              >
                <Icon name="register" />
                <span className="side-nav-link-label">User Management</span>
              </NavLink>
            ) : null}
            {detailLabel ? (
              <span
                className="nav-link side-nav-link band-blue active"
                aria-label={detailLabel}
                data-label={detailLabel}
              >
                <Icon name="detail" />
                <span className="side-nav-link-label">{detailLabel}</span>
              </span>
            ) : null}
          </nav>

          <div className="side-nav-footer">
            <div className="session-menu" ref={menuRef}>
              <button
                type="button"
                className="session-panel session-trigger band-blue"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <div className="session-user-row">
                  <Icon name="portfolio" className="session-user-icon" />
                  <div className="session-name">{user?.name || user?.email || 'Unknown user'}</div>
                </div>
              </button>

              {menuOpen ? (
                <div className="session-dropdown">
                  <button type="button" className="session-action session-inline-btn" onClick={logout}>
                    <Icon name="signout" />
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="app-content">
          <header className="page-header page-header-split band-blue">
            <div>
              <h1>
                {detailLabel ? (
                  <>
                    <span className="page-header-detail-label">{detailLabel}</span>
                    <span className="page-header-divider">|</span>
                  </>
                ) : null}
                {title}
              </h1>
              <p>{description}</p>
            </div>

            <div className="page-header-actions">
              {topNavActions}
            </div>
          </header>

          {bandedChildren}
        </main>
      </div>
    </div>
  );
}

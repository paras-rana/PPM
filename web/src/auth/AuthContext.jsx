import { useEffect, useState } from 'react';
import { AuthContext } from './authContextValue';
import { WORKSPACES, isValidWorkspace } from '../lib/workspace';
import {
  canAddInitiatives,
  canAddStrategies,
  canManagePortfolio,
  canManageRisks,
  canManageStrategy,
  canManageUsers,
  canViewInitiatives,
  canViewPortfolioDashboard,
  canViewProjects,
  canViewStrategies,
  canReviewProposals,
  canSubmitProjects,
  hasAllPermissions,
  hasAnyPermission,
  normalizePermissions,
} from './roles';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const AUTH_STORAGE_KEY = import.meta.env.VITE_AUTH_STORAGE_KEY ?? 'riskapp.ppm.auth';
const ACTIVE_WORKSPACE_STORAGE_KEY = 'riskapp.active-workspace';
const APP_WORKSPACE = WORKSPACES.PPM;

function readStoredSession() {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function readActiveWorkspace() {
  const workspace = window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  return isValidWorkspace(workspace) ? workspace : null;
}

function normalizeSession(session) {
  if (!session) return null;

  return {
    ...session,
    user: session.user
      ? {
          ...session.user,
          role: String(session.user.role ?? '').trim().toUpperCase(),
          permissions: normalizePermissions(session.user.permissions),
        }
      : null,
    workspace: isValidWorkspace(session.workspace) ? session.workspace : APP_WORKSPACE,
  };
}

function persistSession(session) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => normalizeSession(readStoredSession()));
  const [authReady, setAuthReady] = useState(false);
  const role = String(session?.user?.role ?? '').trim().toUpperCase();
  const permissions = normalizePermissions(session?.user?.permissions);

  useEffect(() => {
    async function validateSession() {
      const stored = normalizeSession(readStoredSession());
      const activeWorkspace = readActiveWorkspace();

      // The auth payload is workspace-specific, so clear it if another app owns the session.
      if (activeWorkspace && activeWorkspace !== APP_WORKSPACE) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setSession(null);
        setAuthReady(true);
        return;
      }

      if (!stored?.token) {
        setSession(null);
        setAuthReady(true);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${stored.token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const nextSession = normalizeSession({
          ...stored,
          user: data.user,
        });

        persistSession(nextSession);
        setSession(nextSession);
      } catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setSession(null);
      } finally {
        setAuthReady(true);
      }
    }

    void validateSession();
  }, []);

  async function login(email, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    const nextSession = normalizeSession({
      token: data.token,
      user: data.user,
      expiresAt: data.expiresAt,
      workspace: APP_WORKSPACE,
    });

    persistSession(nextSession);
    window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, APP_WORKSPACE);
    setSession(nextSession);
    return nextSession;
  }

  function setWorkspace(workspace) {
    if (workspace !== APP_WORKSPACE) return;

    setSession((currentSession) => {
      if (!currentSession) return currentSession;

      const nextSession = {
        ...currentSession,
        workspace,
      };
      persistSession(nextSession);
      return nextSession;
    });
  }

  function logout() {
    if (readActiveWorkspace() === APP_WORKSPACE) {
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    }
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        authReady,
        isAuthenticated: Boolean(session?.token),
        token: session?.token ?? '',
        user: session?.user ?? null,
        role,
        permissions,
        expiresAt: session?.expiresAt ?? null,
        workspace: session?.workspace ?? APP_WORKSPACE,
        hasPermissions: (requiredPermissions) => hasAllPermissions(permissions, requiredPermissions),
        hasAnyPermission: (requiredPermissions) => hasAnyPermission(permissions, requiredPermissions),
        canViewPortfolioDashboard: canViewPortfolioDashboard(permissions),
        canViewProjects: canViewProjects(permissions),
        canViewInitiatives: canViewInitiatives(permissions),
        canViewStrategies: canViewStrategies(permissions),
        canAddStrategies: canAddStrategies(permissions),
        canAddInitiatives: canAddInitiatives(permissions),
        canManageStrategy: canManageStrategy(permissions),
        canManageUsers: canManageUsers(permissions),
        canReviewProposals: canReviewProposals(permissions),
        canSubmitProjects: canSubmitProjects(permissions),
        canManagePortfolio: canManagePortfolio(permissions),
        canManageRisks: canManageRisks(permissions),
        login,
        logout,
        setWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

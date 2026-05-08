import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { PERMISSION_OPTIONS, normalizePermissions } from '../auth/roles';
import AppFrame from '../components/AppFrame';
import Icon from '../components/Icon';
import { apiFetch } from '../lib/api';

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function slugifyRoleKey(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function renderPermissionTable({ permissions, onToggle, mode }) {
  return (
    <div className="table-wrap">
      <table className="simple-table">
        <thead>
          <tr>
            <th>Select</th>
            <th>Capability</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {PERMISSION_OPTIONS.map((permission) => (
            <tr key={`${mode}-${permission.key}`}>
              <td>
                <input
                  type="checkbox"
                  checked={permissions.includes(permission.key)}
                  onChange={() => onToggle(mode, permission.key)}
                />
              </td>
              <td>{permission.label}</td>
              <td>{permission.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RoleDefinitionPage() {
  const { token, logout } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedRoleKey, setSelectedRoleKey] = useState('');
  const [editForm, setEditForm] = useState({
    displayName: '',
    permissions: [],
  });
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    displayName: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadRoles() {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch('/auth/roles', {
          token,
          onUnauthorized: logout,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || `HTTP ${response.status}`);
        }

        const nextRoles = data.roles ?? [];
        if (ignore) {
          return;
        }

        // Selecting a role should stay local to the page; the full role list only
        // needs to be fetched when auth context changes.
        setRoles(nextRoles);
        setSelectedRoleKey((currentRoleKey) => currentRoleKey || nextRoles[0]?.roleKey || '');
      } catch (loadError) {
        if (!ignore) {
          setError(`Failed to load roles: ${getErrorMessage(loadError)}`);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadRoles();

    return () => {
      ignore = true;
    };
  }, [token, logout]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.roleKey === selectedRoleKey) ?? null,
    [roles, selectedRoleKey],
  );

  useEffect(() => {
    if (!selectedRole) return;

    setEditForm({
      displayName: selectedRole.displayName ?? '',
      permissions: normalizePermissions(selectedRole.permissions),
    });
  }, [selectedRole]);

  function togglePermission(formKey, permissionKey) {
    const updater = (current) => {
      const exists = current.permissions.includes(permissionKey);
      return {
        ...current,
        permissions: exists
          ? current.permissions.filter((permission) => permission !== permissionKey)
          : [...current.permissions, permissionKey],
      };
    };

    if (formKey === 'create') {
      setCreateForm(updater);
      return;
    }

    setEditForm(updater);
  }

  async function saveRoleDefinition() {
    if (!selectedRoleKey) return;

    try {
      setSaving(true);
      setError('');
      setNotice('');
      const response = await apiFetch(`/auth/roles/${selectedRoleKey}`, {
        method: 'PUT',
        token,
        onUnauthorized: logout,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      setRoles((current) => current.map((role) => (role.roleKey === selectedRoleKey ? data.role : role)));
      setNotice(`Saved role definition for ${data.role.displayName}.`);
    } catch (saveError) {
      setError(`Failed to save role definition: ${getErrorMessage(saveError)}`);
    } finally {
      setSaving(false);
    }
  }

  async function createRole(event) {
    event.preventDefault();

    try {
      setCreating(true);
      setError('');
      setNotice('');
      const payload = {
        roleKey: slugifyRoleKey(createForm.displayName),
        displayName: createForm.displayName.trim(),
        permissions: normalizePermissions(PERMISSION_OPTIONS.map((permission) => permission.key)),
      };
      const response = await apiFetch('/auth/roles', {
        method: 'POST',
        token,
        onUnauthorized: logout,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      setRoles((current) => [...current, data.role]);
      setSelectedRoleKey(data.role.roleKey);
      setEditForm({
        displayName: data.role.displayName,
        permissions: normalizePermissions(data.role.permissions),
      });
      setCreateForm({
        displayName: '',
      });
      setNotice(`Created role ${data.role.displayName}.`);
    } catch (createError) {
      setError(`Failed to create role: ${getErrorMessage(createError)}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppFrame
      title="Role Definition"
      description="Define role-based access controls and create new roles."
      topNavActions={(
        <Link className="secondary-btn" to="/admin/users">
          <Icon name="register" />
          User Management
        </Link>
      )}
    >
      <section className="panel">
        <div className="panel-header-row">
          <h2><Icon name="plus" />Create Role</h2>
          <div className="muted">Add a new role with full access, then refine permissions below</div>
        </div>

        <form className="risk-form ppm-form" onSubmit={createRole}>
          <div className="inline-form-grid">
            <label>
              Role Name
              <input
                value={createForm.displayName}
                onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="detail-actions-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setCreateForm({ displayName: '' })}
            >
              Reset
            </button>
            <button type="submit" className="primary-btn" disabled={creating}>
              {creating ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2><Icon name="filter" />Role Access Controls</h2>
          <div className="muted">Select a role to view and update its granted access</div>
        </div>

        {notice ? <p>{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {loading ? <p>Loading roles...</p> : null}

        {!loading ? (
          <>
            <div className="inline-form-grid">
              <label>
                Role
                <select
                  value={selectedRoleKey}
                  onChange={(event) => setSelectedRoleKey(event.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.roleKey} value={role.roleKey}>
                      {role.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedRole ? (
              <>
                {renderPermissionTable({
                  permissions: editForm.permissions,
                  onToggle: togglePermission,
                  mode: 'edit',
                })}

                <div className="detail-actions-row">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => void saveRoleDefinition()}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Role Definition'}
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">No roles available.</p>
            )}
          </>
        ) : null}
      </section>
    </AppFrame>
  );
}

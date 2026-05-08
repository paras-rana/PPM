import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AppFrame from '../components/AppFrame';
import Icon from '../components/Icon';
import { apiFetch } from '../lib/api';

function createNewUserForm() {
  return {
    email: '',
    name: '',
    role: '',
    password: '',
  };
}

function createEditForm(user) {
  return {
    email: user.email ?? '',
    name: user.name ?? '',
    role: user.role ?? '',
    password: '',
  };
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function formatRole(role) {
  return String(role ?? '')
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

export default function UserManagementPage() {
  const { token, logout, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createForm, setCreateForm] = useState(() => createNewUserForm());
  const [createSaving, setCreateSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [savingUserId, setSavingUserId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch('/auth/users', {
          token,
          onUnauthorized: logout,
        });
        const rolesResponse = await apiFetch('/auth/roles', {
          token,
          onUnauthorized: logout,
        });
        const data = await response.json().catch(() => ({}));
        const rolesData = await rolesResponse.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || `HTTP ${response.status}`);
        }
        if (!rolesResponse.ok) {
          throw new Error(rolesData.message || `HTTP ${rolesResponse.status}`);
        }

        setUsers(data.users ?? []);
        setRoles(rolesData.roles ?? []);
        setCreateForm((current) => ({
          ...current,
          role: current.role || rolesData.roles?.[0]?.roleKey || '',
        }));
      } catch (loadError) {
        setError(`Failed to load users: ${getErrorMessage(loadError)}`);
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [token, logout]);

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => String(left.email).localeCompare(String(right.email))),
    [users],
  );
  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.roleKey, label: role.displayName || formatRole(role.roleKey) })),
    [roles],
  );

  function beginEdit(user) {
    setNotice('');
    setError('');
    setEditingUserId(user.userId);
    setEditForm(createEditForm(user));
  }

  function cancelEdit() {
    setEditingUserId('');
    setEditForm(null);
  }

  async function createUser(event) {
    event.preventDefault();

    try {
      setCreateSaving(true);
      setNotice('');
      setError('');

      const response = await apiFetch('/auth/users', {
        method: 'POST',
        token,
        onUnauthorized: logout,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      setUsers((current) => [...current, data.user]);
      setCreateForm(createNewUserForm());
      setNotice(`Created user ${data.user.email}.`);
    } catch (createError) {
      setError(`Failed to create user: ${getErrorMessage(createError)}`);
    } finally {
      setCreateSaving(false);
    }
  }

  async function saveEdit(userId) {
    if (!editForm) return;

    try {
      setSavingUserId(userId);
      setNotice('');
      setError('');

      const response = await apiFetch(`/auth/users/${userId}`, {
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

      setUsers((current) => current.map((item) => (item.userId === userId ? data.user : item)));
      setNotice(`Updated user ${data.user.email}.`);
      cancelEdit();
    } catch (saveError) {
      setError(`Failed to update user: ${getErrorMessage(saveError)}`);
    } finally {
      setSavingUserId('');
    }
  }

  async function deleteUser(userId) {
    try {
      setDeletingUserId(userId);
      setNotice('');
      setError('');

      const response = await apiFetch(`/auth/users/${userId}`, {
        method: 'DELETE',
        token,
        onUnauthorized: logout,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      setUsers((current) => current.filter((item) => item.userId !== userId));
      setNotice('User deleted.');
      if (editingUserId === userId) {
        cancelEdit();
      }
    } catch (deleteError) {
      setError(`Failed to delete user: ${getErrorMessage(deleteError)}`);
    } finally {
      setDeletingUserId('');
    }
  }

  return (
    <AppFrame
      title="User Management"
      description="Admin controls for creating users, updating roles, and removing access."
      topNavActions={(
        <Link className="secondary-btn" to="/admin/users/roles">
          <Icon name="register" />
          Role Definition
        </Link>
      )}
    >
      <section className="panel">
        <div className="panel-header-row">
          <h2><Icon name="plus" />Add User</h2>
          <div className="muted">Create a new application user and assign a role</div>
        </div>

        <form className="risk-form ppm-form" onSubmit={createUser}>
          <div className="inline-form-grid">
            <label>
              Email
              <input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label>
              Full Name
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Role
              <select
                value={createForm.role}
                onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value }))}
                required
              >
                <option value="" disabled>Select role</option>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </label>
            <label>
              Password
              <input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="detail-actions-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setCreateForm(createNewUserForm())}
            >
              Reset
            </button>
            <button type="submit" className="primary-btn" disabled={createSaving}>
              {createSaving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2><Icon name="register" />Existing Users</h2>
          <div className="muted">{sortedUsers.length} user(s)</div>
        </div>

        {notice ? <p>{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {loading ? <p>Loading users...</p> : null}

        {!loading ? (
          <div className="table-wrap">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Password Reset</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((item) => {
                  const isEditing = editingUserId === item.userId && editForm;
                  const isCurrentUser = currentUser?.userId === item.userId;

                  return (
                    <tr key={item.userId}>
                      <td>{item.userId}</td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editForm.name}
                            onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                          />
                        ) : (
                          item.name || '-'
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                          />
                        ) : (
                          item.email
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            value={editForm.role}
                            onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}
                          >
                            {roleOptions.map((role) => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="pill medium">
                            {roles.find((role) => role.roleKey === item.role)?.displayName || formatRole(item.role)}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))}
                            placeholder="Leave blank to keep current password"
                          />
                        ) : (
                          <span className="muted">Set during edit</span>
                        )}
                      </td>
                      <td>
                        <div className="detail-actions-row">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="primary-btn"
                                disabled={savingUserId === item.userId}
                                onClick={() => void saveEdit(item.userId)}
                              >
                                {savingUserId === item.userId ? 'Saving...' : 'Save'}
                              </button>
                              <button type="button" className="secondary-btn" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="secondary-btn" onClick={() => beginEdit(item)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="secondary-btn"
                                disabled={isCurrentUser || deletingUserId === item.userId}
                                onClick={() => void deleteUser(item.userId)}
                              >
                                {deletingUserId === item.userId ? 'Deleting...' : 'Delete'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">No users found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </AppFrame>
  );
}

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { sendPasswordResetEmail } from "firebase/auth";
import { Eye, KeyRound, MoreVertical, RefreshCw, Trash2, UserRound } from "lucide-react";
import { auth, functions } from "../../firebase";

function formatCreatedAt(timestamp) {
  if (!timestamp) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

export default function ActiveUsers() {
  const [users, setUsers] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadUsers() {
    setIsLoading(true);
    setError("");
    try {
      const listUsers = httpsCallable(functions, "listAdminAuthorizedUsers");
      const result = await listUsers();
      setUsers(result.data.users || []);
    } catch (loadError) {
      setError(loadError && loadError.message ? loadError.message : "Unable to load active users.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(function () {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, []);

  async function handleResetPassword(user) {
    setOpenMenu(null);
    setBusyEmail(user.email);
    setMessage("");
    setError("");
    try {
      const authorizeReset = httpsCallable(functions, "requestAuthorizedPasswordReset");
      const result = await authorizeReset({ email: user.email });
      await sendPasswordResetEmail(auth, result.data.email);
      setMessage(`Password reset email sent to ${user.email}.`);
    } catch (resetError) {
      setError(resetError && resetError.message ? resetError.message : "Unable to send password reset email.");
    } finally {
      setBusyEmail("");
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;

    setBusyEmail(userToDelete.email);
    setMessage("");
    setError("");
    try {
      const deleteUser = httpsCallable(functions, "deleteAuthorizedUser");
      await deleteUser({ email: userToDelete.email });
      setUsers(function (currentUsers) {
        return currentUsers.filter(function (user) { return user.email !== userToDelete.email; });
      });
      setUserToDelete(null);
      setMessage("Authorized Personnel account deleted successfully.");
    } catch (deleteError) {
      setError(deleteError && deleteError.message ? deleteError.message : "Unable to delete this user.");
    } finally {
      setBusyEmail("");
    }
  }

  return (
    <section className="active-users-page">
      <div className="active-users-header">
        <div>
          <p className="section-kicker">Account management</p>
          <h1>Active User</h1>
          <p>Manage Authorized Personnel accounts created by this Admin.</p>
        </div>
        <button type="button" className="active-users-refresh" onClick={loadUsers} disabled={isLoading} aria-label="Refresh active users" title="Refresh active users">
          <RefreshCw size={18} className={isLoading ? "active-users-spin" : ""} />
        </button>
      </div>

      {message && <p className="admin-form-message admin-form-message--success" role="status">{message}</p>}
      {error && <p className="admin-form-message admin-form-message--error" role="alert">{error}</p>}

      <div className="active-users-table-shell">
        <div className="active-users-table-heading">
          <div><UserRound size={18} /><span>Authorized Personnel</span></div>
          <span className="active-users-count">{users.length} active</span>
        </div>
        {isLoading ? <p className="active-users-empty">Loading active users...</p> : users.length === 0 ? <p className="active-users-empty">No Admin-created Authorized Personnel accounts found.</p> : (
          <div className="active-users-table-wrap">
            <table className="active-users-table">
              <thead><tr><th>Full Name</th><th>Email</th><th>Position / Sub-role</th><th>Status</th><th>Date Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{users.map(function (user) {
                const isBusy = busyEmail === user.email;
                return <tr key={user.email}>
                  <td data-label="Full Name"><strong>{user.fullName}</strong></td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Position / Sub-role">{user.subRole}</td>
                  <td data-label="Status"><span className="status-pill status-pill--active">Active</span></td>
                  <td data-label="Date Created">{formatCreatedAt(user.createdAt)}</td>
                  <td className="active-users-actions-cell">
                    <button type="button" className="active-users-action-button" onClick={function (event) {
                      if (openMenu === user.email) {
                        setOpenMenu(null);
                        setMenuPosition(null);
                        return;
                      }

                      const buttonRect = event.currentTarget.getBoundingClientRect();
                      const menuHeight = 134;
                      const menuWidth = 180;
                      const top = buttonRect.bottom + 8 + menuHeight > window.innerHeight
                        ? buttonRect.top - menuHeight - 8
                        : buttonRect.bottom + 8;
                      const left = Math.max(8, Math.min(buttonRect.right - menuWidth, window.innerWidth - menuWidth - 8));
                      setMenuPosition({ top, left });
                      setOpenMenu(user.email);
                    }} disabled={isBusy} aria-label={`Actions for ${user.fullName}`} aria-expanded={openMenu === user.email} title="User actions"><MoreVertical size={18} /></button>
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </div>

      {openMenu && menuPosition && <div className="active-users-action-menu" style={{ top: menuPosition.top, left: menuPosition.left }}>
        <button type="button" onClick={function () { setSelectedUser(users.find(function (user) { return user.email === openMenu; })); setOpenMenu(null); setMenuPosition(null); }}><Eye size={16} />View details</button>
        <button type="button" onClick={function () { handleResetPassword(users.find(function (user) { return user.email === openMenu; })); }}><KeyRound size={16} />Reset password</button>
        <button type="button" className="active-users-delete-action" onClick={function () { setUserToDelete(users.find(function (user) { return user.email === openMenu; })); setOpenMenu(null); setMenuPosition(null); }}><Trash2 size={16} />Delete user</button>
      </div>}

      {selectedUser && <div className="active-users-modal-backdrop" role="presentation" onClick={function () { setSelectedUser(null); }}>
        <div className="active-users-modal" role="dialog" aria-modal="true" aria-labelledby="active-user-details-title" onClick={function (event) { event.stopPropagation(); }}>
          <div className="active-users-modal-header"><div><p className="section-kicker">Account details</p><h2 id="active-user-details-title">{selectedUser.fullName}</h2></div><button type="button" onClick={function () { setSelectedUser(null); }} aria-label="Close details">×</button></div>
          <dl className="active-users-details"><div><dt>Full Name</dt><dd>{selectedUser.fullName}</dd></div><div><dt>Email</dt><dd>{selectedUser.email}</dd></div><div><dt>Position / Sub-role</dt><dd>{selectedUser.subRole}</dd></div><div><dt>Status</dt><dd><span className="status-pill status-pill--active">Active</span></dd></div><div><dt>Date Created</dt><dd>{formatCreatedAt(selectedUser.createdAt)}</dd></div></dl>
        </div>
      </div>}

      {userToDelete && <div className="active-users-modal-backdrop" role="presentation">
        <div className="active-users-modal active-users-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
          <h2 id="delete-user-title">Delete user?</h2><p>Are you sure you want to delete this user?</p><p className="active-users-confirm-name">{userToDelete.fullName}<br /><span>{userToDelete.email}</span></p>
          <div className="active-users-modal-actions"><button type="button" className="active-users-secondary-button" onClick={function () { setUserToDelete(null); }} disabled={Boolean(busyEmail)}>Cancel</button><button type="button" className="active-users-danger-button" onClick={handleDeleteUser} disabled={Boolean(busyEmail)}>{busyEmail ? "Deleting..." : "Delete user"}</button></div>
        </div>
      </div>}
    </section>
  );
}
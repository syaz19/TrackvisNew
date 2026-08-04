import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useState, useEffect, useRef } from "react";
import { auth } from "../firebase";
import { clearAuthState } from "../authManager";

export default function Sidebar({ role, isOpen, onClose, currentUser, userData }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();

  async function handleLogout() {
    // Step 1: lumabas sa Firebase.
    // Step 2: i-clear ang local auth state.
    // Step 3: dalhin ulit ang user sa login page.
    try {
      const currentUserUid = auth.currentUser?.uid || null;
      await signOut(auth);
      clearAuthState();
      window.dispatchEvent(new CustomEvent("trackvis-logout", { detail: { uid: currentUserUid } }));
      navigate("/", { replace: true });
    } catch (error) {
      alert(error.message);
    }
  }

  // Piliin ang listahan ng menu base sa role ng user.
  let menuLinks = [];

  if (role === "security") {
    menuLinks = [
      { to: "/security/map", label: "SCC 3D" },
      { to: "/security/register", label: "Register Visitor" },
      { to: "/security/history", label: "History" },
      { to: "/security/growth", label: "Growth" }
    ];
  } else if (role === "authorized") {
    menuLinks = [
      { to: "/authorized/map", label: "SCC 3D" },
      { to: "/authorized", label: "Dashboard" }
    ];
  }

  let overlayClassName = "mobile-menu-overlay";
  let sidebarClassName = "sidebar";

  if (isOpen) {
    overlayClassName = "mobile-menu-overlay open";
    sidebarClassName = "sidebar open";
  }

  const email = currentUser?.email || userData?.email || "guest@example.com";
  const displayName = userData?.name || userData?.fullName || email.split("@")[0] || "Guest";
  const roleLabel = role === "security" ? "Security" : role === "authorized" ? "Authorized Personnel" : userData?.role || "User";
  const profileInitial = displayName.charAt(0).toUpperCase() || "G";

  function handleProfileToggle() {
    setProfileOpen(function (current) {
      return !current;
    });
  }

  useEffect(
    function () {
      if (!profileOpen) {
        return undefined;
      }

      function handleClickOutside(event) {
        if (profileRef.current && !profileRef.current.contains(event.target)) {
          setProfileOpen(false);
        }
      }

      window.addEventListener("mousedown", handleClickOutside);
      return function () {
        window.removeEventListener("mousedown", handleClickOutside);
      };
    },
    [profileOpen]
  );

  return (
    <>
      <div className={overlayClassName} onClick={onClose} />
      <aside className={sidebarClassName}>
        <div className="sidebar-header">
          <div className="brand-block">
            <div className="brand-mark">TV</div>
            <div>
              <p className="brand-label">TRACKVIS</p>
              <p className="brand-subtitle">Visitor tracking v2</p>
            </div>
          </div>
          <button type="button" className="close-menu-button" onClick={onClose}>
            ×
          </button>
        </div>

        <nav className="nav-links">
          {menuLinks.map(function (link) {
            return (
              <Link key={link.to} to={link.to} onClick={onClose}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-profile-group" ref={profileRef}>
            <button type="button" className="sidebar-profile-card" onClick={handleProfileToggle} aria-expanded={profileOpen}>
              <div className="sidebar-profile-avatar">{profileInitial}</div>
              <div className="sidebar-profile-details">
                <p className="sidebar-profile-name">{displayName}</p>
                <p className="sidebar-profile-role">{roleLabel}</p>
              </div>
            </button>

            {profileOpen && (
              <div className="sidebar-profile-popup">
                <p className="sidebar-profile-popup-title">Account Info</p>
                <div className="sidebar-profile-popup-row">
                  <span>Name</span>
                  <strong>{displayName}</strong>
                </div>
                <div className="sidebar-profile-popup-row">
                  <span>Email</span>
                  <strong>{email}</strong>
                </div>
                <div className="sidebar-profile-popup-row">
                  <span>Role</span>
                  <strong>{roleLabel}</strong>
                </div>
              </div>
            )}
          </div>

          <button className="logout-button" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

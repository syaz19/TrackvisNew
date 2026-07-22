import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { clearAuthState } from "../authManager";

export default function Sidebar({ role, isOpen, onClose }) {
  const navigate = useNavigate();

  async function handleLogout() {
    // Step 1: lumabas sa Firebase.
    // Step 2: i-clear ang local auth state.
    // Step 3: dalhin ulit ang user sa login page.
    try {
      await signOut(auth);
      clearAuthState();
      window.dispatchEvent(new Event("trackvis-logout"));
      navigate("/", { replace: true });
    } catch (error) {
      alert(error.message);
    }
  }

  // Piliin ang listahan ng menu base sa role ng user.
  let menuLinks = [];

  if (role === "security") {
    menuLinks = [
      { to: "/security", label: "Dashboard" },
      { to: "/security/register", label: "Register Visitor" },
      { to: "/security/history", label: "History" },
      { to: "/security/growth", label: "Growth" },
      { to: "/security/map", label: "View Map" }
    ];
  } else if (role === "authorized") {
    menuLinks = [
      { to: "/authorized", label: "Dashboard" },
      { to: "/authorized/map", label: "View Map" }
    ];
  }

  let overlayClassName = "mobile-menu-overlay";
  let sidebarClassName = "sidebar";

  if (isOpen) {
    overlayClassName = "mobile-menu-overlay open";
    sidebarClassName = "sidebar open";
  }

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
          <button className="logout-button" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { clearAuthState } from "../authManager";

export default function Sidebar({ role, isOpen, onClose }) {
  const navigate = useNavigate();

  async function handleLogout() {
    // Sinisiguro ang logout sa Firebase at sa local app state.
    try {
      await signOut(auth);
      clearAuthState();
      window.dispatchEvent(new Event("trackvis-logout"));
      navigate("/", { replace: true });
    } catch (error) {
      alert(error.message);
    }
  }

  // Pinipili ang mga link base sa role ng user.
  let links = [];

  if (role === "security") {
    links = [
      { to: "/security", label: "Dashboard" },
      { to: "/security/register", label: "Register Visitor" },
      { to: "/security/history", label: "History" },
      { to: "/security/growth", label: "Growth" },
      { to: "/security/map", label: "View Map" }
    ];
  } else if (role === "authorized") {
    links = [
      { to: "/authorized", label: "Dashboard" },
      { to: "/authorized/map", label: "View Map" }
    ];
  }

  return (
    <>
      <div className={`mobile-menu-overlay ${isOpen ? "open" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
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
          {links.map((link) => (
            <Link key={link.to} to={link.to} onClick={onClose}>
              {link.label}
            </Link>
          ))}
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

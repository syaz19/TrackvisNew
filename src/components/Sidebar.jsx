import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { clearAuthState } from "../authManager";

export default function Sidebar({ role, isOpen, onClose }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // dispatch a custom event so App can update auth state immediately
      // also clear auth state via manager (immediate)
      clearAuthState();
      // dispatch legacy event for compatibility
      window.dispatchEvent(new Event("trackvis-logout"));
      navigate("/", { replace: true });
    } catch (error) {
      alert(error.message);
    }
  };

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
          {role === "security" && (
            <>
              <Link to="/security" onClick={onClose}>
                Dashboard
              </Link>
              <Link to="/security/register" onClick={onClose}>
                Register Visitor
              </Link>
              <Link to="/security/history" onClick={onClose}>
                History
              </Link>
              <Link to="/security/growth" onClick={onClose}>
                Growth
              </Link>
              <Link to="/security/map" onClick={onClose}>
                View Map
              </Link>
            </>
          )}
          {role === "authorized" && (
            <>
              <Link to="/authorized" onClick={onClose}>
                Dashboard
              </Link>
              <Link to="/authorized/map" onClick={onClose}>
                View Map
              </Link>
            </>
          )}
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

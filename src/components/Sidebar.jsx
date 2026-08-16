// Imports mula sa React Router para sa internal navigation at pag-redirect.
import { Link, useNavigate } from "react-router-dom";
// Firebase auth helper para mag-sign out ang user.
import { signOut } from "firebase/auth";
// React hooks na gagamitin: state, lifecycle effects, at refs.
import { useState, useEffect, useRef } from "react";
// Firebase auth instance mula sa lokal na firebase config.
import { auth, db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
// Helper para i-clear ang local auth state (custom app logic sa authManager).
import { clearAuthState } from "../authManager";

// Sidebar component - props:
// - role: "security" | "authorized" | others
// - isOpen: boolean para sa mobile menu visibility
// - onClose: function callback kapag isinara ang menu
// - currentUser: firebase auth user object
// - userData: Firestore user document data
export default function Sidebar({ role, isOpen, onClose, currentUser, userData }) {
  // state para i-toggle ang profile popup visibility
  const [profileOpen, setProfileOpen] = useState(false);
  // ref para sa profile popup element para madetect ang click outside
  const profileRef = useRef(null);
  // navigate function para mag-redirect programmatically
  const navigate = useNavigate();
  const [pendingVisitorCount, setPendingVisitorCount] = useState(0);

  useEffect(
    function () {
      if (role !== "authorized" || !userData?.subRole) {
        return undefined;
      }

      const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
        const count = snapshot.docs.filter(function (item) {
          const visitor = item.data();
          return (
            (visitor.destination || "") === userData.subRole &&
            visitor.status === "active" &&
            (visitor.confirmStatus || "") !== "Done"
          );
        }).length;

        setPendingVisitorCount(count);
      });

      return function () {
        unsubscribe();
      };
    },
    [role, userData]
  );

  // function na tina-trigger kapag nag-logout ang user
  async function handleLogout() {
    // 1) kuhanin ang kasalukuyang UID (optional) para i-broadcast sa app
    // 2) sign out mula sa Firebase Auth
    // 3) i-clear ang local auth state at i-dispatch ang custom event
    // 4) i-redirect ang user pabalik sa login route
    try {
      const currentUserUid = auth.currentUser?.uid || null;
      await signOut(auth);
      clearAuthState();
      // event para ang ibang bahagi ng app ay maaaring mag-react sa logout
      window.dispatchEvent(new CustomEvent("trackvis-logout", { detail: { uid: currentUserUid } }));
      // palitan ang history upang hindi makabalik sa restricted pages
      navigate("/", { replace: true });
    } catch (error) {
      // ipakita ang error sa user kung may nangyaring mali habang nag-logout
      alert(error.message);
    }
  }

  // Tukuyin ang menu links base sa role ng user (security vs authorized)
  let menuLinks = [];

  if (role === "security") {
    // Security view links: SCC 3D map, Dashboard, History, Growth analytics
    menuLinks = [
      { to: "/security/map", label: "SCC 3D" },
      { to: "/security", label: "Dashboard" },
      { to: "/security/history", label: "History" },
      { to: "/security/growth", label: "Growth" }
    ];
  } else if (role === "authorized") {
    // Authorized personnel links: their map, dashboard, and history
    menuLinks = [
      { to: "/authorized/map", label: "SCC 3D" },
      { to: "/authorized", label: "Dashboard", count: pendingVisitorCount },
      { to: "/authorized/history", label: "History" }
    ];
  }

  // CSS class names toggled para sa mobile open/close behavior
  let overlayClassName = "mobile-menu-overlay";
  let sidebarClassName = "sidebar";

  if (isOpen) {
    // kapag open, idagdag ang `open` modifier para sa animation/styles
    overlayClassName = "mobile-menu-overlay open";
    sidebarClassName = "sidebar open";
  }

  // Pangalan at email na ipapakita sa profile area; fallback values kung wala
  const email = currentUser?.email || userData?.email || "guest@example.com";
  const displayName = userData?.name || userData?.fullName || email.split("@")[0] || "Guest";
  // Human-readable role label para ipakita sa UI
  const roleLabel = role === "security" ? "Security" : role === "authorized" ? "Authorized Personnel" : userData?.role || "User";
  // Unang letra ng display name para sa avatar badge
  const profileInitial = displayName.charAt(0).toUpperCase() || "G";

  // Toggle handler para sa profile popup
  function handleProfileToggle() {
    setProfileOpen(function (current) {
      return !current;
    });
  }

  // Effect: kapag bukas ang profile popup, mag-listen sa clicks sa window para isara kapag nag-click outside
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

  // JSX return: sidebar layout, nav links, profile area, and logout button
  return (
    <>
      {/* Overlay na ginagamit para i-close ang mobile menu kapag na-click */}
      <div className={overlayClassName} onClick={onClose} />
      {/* Main sidebar container */}
      <aside className={sidebarClassName}>
        {/* Header area na may brand mark at close button */}
        <div className="sidebar-header">
          <div className="brand-block">
            {/* maliit na marka para sa app */}
            <div className="brand-mark">TV</div>
            <div>
              {/* App title */}
              <p className="brand-label">TRACKVIS</p>
              {/* maliit na subtitle */}
              <p className="brand-subtitle">Visitor tracking v2</p>
            </div>
          </div>
          {/* Close button para sa mobile menu */}
          <button type="button" className="close-menu-button" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Navigation links generated mula sa `menuLinks` array */}
        <nav className="nav-links">
          {menuLinks.map(function (link) {
            const isDashboardWithCount = role === "authorized" && link.to === "/authorized" && link.count > 0;

            return (
              // bawat Link ay nagna-navigate papunta sa tinukoy na ruta at nagsasara ng menu pagkatapos
              <Link key={link.to} to={link.to} onClick={onClose} className={isDashboardWithCount ? "nav-link-with-count" : ""}>
                <span>{link.label}</span>
                {isDashboardWithCount && <span className="nav-link-count">{link.count}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer area: profile card at logout button */}
        <div className="sidebar-footer">
          <div className="sidebar-profile-group" ref={profileRef}>
            {/* Profile card boton na nagto-toggle ng profile popup */}
            <button type="button" className="sidebar-profile-card" onClick={handleProfileToggle} aria-expanded={profileOpen}>
              {/* Avatar initial */}
              <div className="sidebar-profile-avatar">{profileInitial}</div>
              <div className="sidebar-profile-details">
                {/* Ipakita ang pangalan ng user */}
                <p className="sidebar-profile-name">{displayName}</p>
                {/* Ipakita ang role */}
                <p className="sidebar-profile-role">{roleLabel}</p>
              </div>
            </button>

            {/* Profile popup na naglalaman ng account details; lumalabas kapag `profileOpen` true */}
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

          {/* Logout button sa footer */}
          <button className="logout-button" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

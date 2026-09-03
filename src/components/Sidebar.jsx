// Imports mula sa React Router para sa internal navigation at pag-redirect.
import { Link, useLocation, useNavigate } from "react-router-dom";
// Firebase auth helper para mag-sign out ang user.
import { signOut } from "firebase/auth";
// React hooks na gagamitin: state at lifecycle effects.
import { useState, useEffect } from "react";
// Firebase auth instance mula sa lokal na firebase config.
import { auth, db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
// Helper para i-clear ang local auth state (custom app logic sa authManager).
import { clearAuthState } from "../authManager";

function getDestinations(visitor) {
  if (Array.isArray(visitor.destinations)) return visitor.destinations;
  if (Array.isArray(visitor.destination)) return visitor.destination;

  if (!visitor.destination) {
    return [];
  }

  const destinations = [];
  const destinationValues = visitor.destination.split(",");

  for (let i = 0; i < destinationValues.length; i++) {
    const destination = destinationValues[i].trim();

    if (destination) {
      destinations.push(destination);
    }
  }

  return destinations;
}

// Sidebar component - props:
// - role: "security" | "authorized" | others
// - isOpen: boolean para sa mobile menu visibility
// - onClose: function callback kapag isinara ang menu
// - currentUser: firebase auth user object
// - userData: Firestore user document data
export default function Sidebar({ role, isOpen, onClose, currentUser, userData }) {
  // navigate function para mag-redirect programmatically
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingVisitorCount, setPendingVisitorCount] = useState(0);

  useEffect(
    function () {
      if (role !== "authorized" || !userData || !userData.subRole) {
        return undefined;
      }

      const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
        let count = 0;

        snapshot.docs.forEach(function (item) {
          const visitor = item.data();
          const isPending = (
            visitor.purpose === "School Related" &&
            getDestinations(visitor).includes(userData.subRole) &&
            visitor.status === "active" &&
            (Array.isArray(visitor.destinationConfirmations)
              ? visitor.destinationConfirmations.some(function (confirmation) {
                return confirmation.destination === userData.subRole && confirmation.status !== "Done";
              })
              : (visitor.confirmStatus || "") !== "Done")
          );

          if (isPending) {
            count += 1;
          }
        });

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
      let currentUserUid = null;

      if (auth.currentUser && auth.currentUser.uid) {
        currentUserUid = auth.currentUser.uid;
      }
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
      { to: "/security/map", label: "San Carlos College 3D" },
      { to: "/security", label: "Dashboard/Deactivation" },
      { to: "/security/history", label: "Visitor History" },
      { to: "/security/growth", label: "Growth Analytics" }
    ];
  } else if (role === "authorized") {
    // Authorized personnel links: their map, dashboard, and history
    menuLinks = [
      { to: "/authorized/map", label: "San Carlos College 3D" },
      { to: "/authorized", label: "Pending Confirm", count: pendingVisitorCount },
      { to: "/authorized/history", label: "History Confirmed" }
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

  // Pangalan at email na ipapakita sa profile area; gamitin ang aktwal na authenticated user
  const email = currentUser && currentUser.email
    ? currentUser.email
    : userData && userData.email
      ? userData.email
      : "";
  const emailName = email ? email.split("@")[0].trim() : "";
  const displayName = userData && userData.name
    ? userData.name
    : userData && userData.fullName
      ? userData.fullName
      : currentUser && currentUser.displayName
        ? currentUser.displayName
        : emailName || "User";
  // Unang letra ng display name para sa avatar badge
  const profileInitial = (displayName || "U").charAt(0).toUpperCase() || "G";
  const accountPath = role === "security" ? "/security/account" : "/authorized/account";
  const isAccountActive = location.pathname === accountPath;

  // JSX return: sidebar layout, nav links, and account/logout actions
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
            const isActive = location.pathname === link.to;
            let linkClassName = "";

            if (isActive) {
              linkClassName = "nav-link-active";
            }

            if (isDashboardWithCount) {
              linkClassName += linkClassName ? " nav-link-with-count" : "nav-link-with-count";
            }

            return (
              // bawat Link ay nagna-navigate papunta sa tinukoy na ruta at nagsasara ng menu pagkatapos
              <Link key={link.to} to={link.to} onClick={onClose} className={linkClassName}>
                <span>{link.label}</span>
                {isDashboardWithCount && <span className="nav-link-count">{link.count}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer area: account button at logout button */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            <button
              type="button"
              className={`sidebar-profile-card ${isAccountActive ? "sidebar-profile-card--active" : ""}`}
              onClick={function () {
                navigate(accountPath);
                if (onClose) {
                  onClose();
                }
              }}
            >
              <div className="sidebar-profile-avatar">{profileInitial}</div>
              <div className="sidebar-profile-details">
                <p className="sidebar-profile-name">{displayName}</p>
              </div>
            </button>

            <button className="logout-button" onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

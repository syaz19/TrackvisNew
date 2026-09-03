
import { Link, useLocation, useNavigate } from "react-router-dom";

import { signOut } from "firebase/auth";

import { useState, useEffect } from "react";

import { auth, db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

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


export default function Sidebar({ role, isOpen, onClose, currentUser, userData }) {
 
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

  
  async function handleLogout() {
    
    try {
      let currentUserUid = null;

      if (auth.currentUser && auth.currentUser.uid) {
        currentUserUid = auth.currentUser.uid;
      }
      await signOut(auth);
      clearAuthState();
      
      window.dispatchEvent(new CustomEvent("trackvis-logout", { detail: { uid: currentUserUid } }));
      
      navigate("/", { replace: true });
    } catch (error) {
      
      alert(error.message);
    }
  }

 
  let menuLinks = [];

  if (role === "security") {
    
    menuLinks = [
      { to: "/security/map", label: "San Carlos College 3D" },
      { to: "/security", label: "Dashboard/Deactivation" },
      { to: "/security/history", label: "Visitor History" },
      { to: "/security/growth", label: "Growth Analytics" }
    ];
  } else if (role === "authorized") {
    
    menuLinks = [
      { to: "/authorized/map", label: "San Carlos College 3D" },
      { to: "/authorized", label: "Pending Confirm", count: pendingVisitorCount },
      { to: "/authorized/history", label: "History Confirmed" }
    ];
  }

  
  let overlayClassName = "mobile-menu-overlay";
  let sidebarClassName = "sidebar";

  if (isOpen) {
    
    overlayClassName = "mobile-menu-overlay open";
    sidebarClassName = "sidebar open";
  }

  
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
  
  const profileInitial = (displayName || "U").charAt(0).toUpperCase() || "G";
  const accountPath = role === "security" ? "/security/account" : "/authorized/account";
  const isAccountActive = location.pathname === accountPath;

  
  return (
    <>
      {}
      <div className={overlayClassName} onClick={onClose} />
      {}
      <aside className={sidebarClassName}>
        {}
        <div className="sidebar-header">
          <div className="brand-block">
            {}
            <div className="brand-mark">TV</div>
            <div>
              {}
              <p className="brand-label">TRACKVIS</p>
              {}
              <p className="brand-subtitle">Visitor tracking v2</p>
            </div>
          </div>
          {}
          <button type="button" className="close-menu-button" onClick={onClose}>
            ×
          </button>
        </div>

        {}
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
              
              <Link key={link.to} to={link.to} onClick={onClose} className={linkClassName}>
                <span>{link.label}</span>
                {isDashboardWithCount && <span className="nav-link-count">{link.count}</span>}
              </Link>
            );
          })}
        </nav>

        {}
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

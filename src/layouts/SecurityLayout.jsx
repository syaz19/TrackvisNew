// SecurityLayout: layout wrapper para sa security staff pages
// Nagpo-provide ng Sidebar (role=security) at Topbar na naka-configure para sa security
import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { db } from "../firebase";

function SecurityPopup({ alert, onDismiss }) {
  if (!alert) {
    return null;
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200000, pointerEvents: "none", padding: "16px" }}>
      <div style={{ pointerEvents: "auto", width: "min(500px, calc(100% - 32px))", background: "rgba(2, 6, 23, 0.98)", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid rgba(148, 163, 184, 0.18)", padding: "18px 20px" }}>
        <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.5 }}>{alert.text}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" onClick={onDismiss} style={{ background: "#2563eb", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}>OK</button>
        </div>
      </div>
    </div>
  );
}

export default function SecurityLayout({ children, currentUser, userData, hideTitle, hideSubtitle, isSmallTitle, title }) {
  // state para sa mobile sidebar open/close
  const [menuOpen, setMenuOpen] = useState(false);
  const [securityAlert, setSecurityAlert] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const previousVisitorSnapshotRef = useRef({});
  const currentTimeRef = useRef(Date.now());

  // Helper functions to manage alert acknowledgments in localStorage
  function getAcknowledgedAlerts() {
    try {
      const stored = localStorage.getItem("acknowledgedAlerts");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  function setAlertAcknowledged(alertKey) {
    const acknowledged = getAcknowledgedAlerts();
    acknowledged[alertKey] = true;
    localStorage.setItem("acknowledgedAlerts", JSON.stringify(acknowledged));
  }

  function isAlertAcknowledged(alertKey) {
    const acknowledged = getAcknowledgedAlerts();
    return acknowledged[alertKey] === true;
  }

  // Real-time timer to check for exceeded times every second
  useEffect(() => {
    const timer = setInterval(() => {
      currentTimeRef.current = Date.now();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for exceeded time alerts in real-time
  useEffect(() => {
    const checkTimer = setInterval(() => {
      const now = currentTimeRef.current;

      visitors.forEach((visitor) => {
        const status = (visitor.status || "").toString().toLowerCase();
        const visitorEndTime = Number(visitor.endTime || 0);
        const hasExceededTime = visitorEndTime > 0 && visitorEndTime <= now;

        // Trigger exceed time alert when time runs out
        if (status === "active" && hasExceededTime) {
          const exceedAlertKey = `exceed_${visitor.id}`;
          
          if (!isAlertAcknowledged(exceedAlertKey)) {
            const visitorName = visitor.name || visitor.id;
            const text = `Our visitor ${visitorName} exceed time`;
            setSecurityAlert({ id: exceedAlertKey, text, type: "exceed" });
          }
        }
      });
    }, 1000);

    return () => clearInterval(checkTimer);
  }, [visitors]);

  useEffect(() => {
    function getVisitorLocationKey(visitor) {
      const locationName = (visitor.currentLocation || visitor.location || "").toString().toLowerCase();
      if (locationName.includes("office")) {
        return "office";
      }
      if (locationName.includes("library")) {
        return "library";
      }
      return "entrance";
    }

    const unsubscribe = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const visitorList = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setVisitors(visitorList);
      const now = Date.now();

      visitorList.forEach((visitor) => {
        const prev = previousVisitorSnapshotRef.current[visitor.id];
        const key = getVisitorLocationKey(visitor);
        const lastSeenChanged = !prev || prev.lastSeen !== visitor.lastSeen || prev.currentLocation !== visitor.currentLocation;
        const status = (visitor.status || "").toString().toLowerCase();
        const visitorEndTime = Number(visitor.endTime || 0);
        const hasExceededTime = visitorEndTime > 0 && visitorEndTime <= now;

        // Check for office reader alert only
        if (key === "office" && lastSeenChanged && !hasExceededTime && status === "active") {
          const officeAlertKey = `office_${visitor.id}`;
          
          if (!isAlertAcknowledged(officeAlertKey)) {
            const visitorName = visitor.name || visitor.id;
            const text = `Our visitor ${visitorName}, scan by the office reader — keep watching.`;
            setAlertAcknowledged(officeAlertKey);
            setSecurityAlert({ id: officeAlertKey, text, type: "office" });
          }
        }

        previousVisitorSnapshotRef.current[visitor.id] = visitor;
      });

      Object.keys(previousVisitorSnapshotRef.current).forEach((id) => {
        if (!visitorList.find((item) => item.id === id)) {
          delete previousVisitorSnapshotRef.current[id];
        }
      });
    });

    return () => unsubscribe();
  }, []);

  function handleAlertDismiss() {
    if (securityAlert?.id) {
      setAlertAcknowledged(securityAlert.id);
    }
    setSecurityAlert(null);
  }

  // Toggle handler para sa topbar mobile menu button
  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  // Isara ang menu (ginagamit bilang callback ng Sidebar at overlay)
  function closeMenu() {
    setMenuOpen(false);
  }

  // Kapag nag-click sa main content area at bukas ang menu, isara ito
  function handleMainClick() {
    if (menuOpen) {
      closeMenu();
    }
  }

  // Render: Sidebar (security) + Topbar + content
  return (
    <div className="container">
      <Sidebar role="security" isOpen={menuOpen} onClose={closeMenu} currentUser={currentUser} userData={userData} />
      <div className="main" onClick={handleMainClick}>
        <Topbar
          role="security"
          title={title || "SECURITY PERSONNEL"}
          onMenuToggle={toggleMenu}
          menuOpen={menuOpen}
          currentUser={currentUser}
          userData={userData}
          hideTitle={hideTitle}
          hideSubtitle={hideSubtitle}
          isSmallTitle={isSmallTitle}
        />
        <div className="content-body">{children}</div>
      </div>
      <SecurityPopup alert={securityAlert} onDismiss={handleAlertDismiss} />
    </div>
  );
}

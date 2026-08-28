// SecurityLayout: layout wrapper para sa security staff pages
// Nagpo-provide ng Sidebar (role=security) at Topbar na naka-configure para sa security
import { useState, useEffect, useRef, useCallback } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { db } from "../firebase";

function SecurityPopup({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 200000, pointerEvents: "none", padding: "16px" }}>
      {alerts.map(function (alert) {
        return (
          <div key={alert.id} style={{ pointerEvents: "auto", width: "min(500px, calc(100% - 32px))", background: "#171A35", borderRadius: 12, boxShadow: "0 20px 60px rgba(9,13,26,0.5)", border: "1px solid #2A3150", padding: "18px 20px" }}>
            <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.5 }}>{alert.text}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" onClick={function () {
                onDismiss(alert.id);
              }} style={{ background: "#4F46E5", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}>OK</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SecurityLayout({ children, currentUser, userData, hideTitle, hideSubtitle, isSmallTitle, title }) {
  // state para sa mobile sidebar open/close
  const [menuOpen, setMenuOpen] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const currentTimeRef = useRef(0);

  useEffect(() => {
    currentTimeRef.current = Date.now();
  }, []);

  // Helper functions to manage alert acknowledgments in localStorage
  const getAcknowledgedAlerts = useCallback(function () {
    try {
      const stored = localStorage.getItem("acknowledgedAlerts");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  const setAlertAcknowledged = useCallback(function (alertKey) {
    const acknowledged = getAcknowledgedAlerts();
    acknowledged[alertKey] = true;
    localStorage.setItem("acknowledgedAlerts", JSON.stringify(acknowledged));
  }, [getAcknowledgedAlerts]);

  const isAlertAcknowledged = useCallback(function (alertKey) {
    const acknowledged = getAcknowledgedAlerts();
    return acknowledged[alertKey] === true;
  }, [getAcknowledgedAlerts]);

  const pushSecurityAlert = useCallback(function (alert) {
    setSecurityAlerts(function (currentAlerts) {
      if (currentAlerts.some(function (item) {
        return item.id === alert.id;
      })) {
        return currentAlerts;
      }

      return [...currentAlerts, alert];
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      const visitorList = snapshot.docs.map(function (item) {
        return {
          id: item.id,
          ...item.data()
        };
      });

      setVisitors(visitorList);
    });

    return function () {
      unsubscribe();
    };
  }, []);

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
            pushSecurityAlert({ id: exceedAlertKey, text, type: "exceed" });
          }
        }
      });
    }, 1000);

    return () => clearInterval(checkTimer);
  }, [visitors, isAlertAcknowledged, pushSecurityAlert]);


  function handleAlertDismiss(alertId) {
    if (alertId) {
      setAlertAcknowledged(alertId);
    }
    setSecurityAlerts(function (currentAlerts) {
      return currentAlerts.filter(function (alert) {
        return alert.id !== alertId;
      });
    });
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
      <SecurityPopup alerts={securityAlerts} onDismiss={handleAlertDismiss} />
    </div>
  );
}

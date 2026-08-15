// SecurityLayout: layout wrapper para sa security staff pages
// Nagpo-provide ng Sidebar (role=security) at Topbar na naka-configure para sa security
import { useState, useEffect, useRef } from "react";
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
          <div key={alert.id} style={{ pointerEvents: "auto", width: "min(500px, calc(100% - 32px))", background: "rgba(2, 6, 23, 0.98)", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid rgba(148, 163, 184, 0.18)", padding: "18px 20px" }}>
            <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.5 }}>{alert.text}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" onClick={function () {
                onDismiss(alert.id);
              }} style={{ background: "#2563eb", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}>OK</button>
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

  function pushSecurityAlert(alert) {
    setSecurityAlerts(function (currentAlerts) {
      if (currentAlerts.some(function (item) {
        return item.id === alert.id;
      })) {
        return currentAlerts;
      }

      return [...currentAlerts, alert];
    });
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
            pushSecurityAlert({ id: exceedAlertKey, text, type: "exceed" });
          }
        }
      });
    }, 1000);

    return () => clearInterval(checkTimer);
  }, [visitors]);

  useEffect(() => {
    const OFFICE_BASELINE_KEY = "trackvis-office-scan-baseline";
    const hasLoadedInitialSnapshot = { current: false };

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

    function getTimestampMillis(value) {
      if (!value) {
        return null;
      }
      if (typeof value.toMillis === "function") {
        return value.toMillis();
      }
      if (typeof value === "number") {
        return value;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function loadOfficeScanBaseline() {
      if (typeof window === "undefined") {
        return {};
      }

      try {
        const stored = window.localStorage.getItem(OFFICE_BASELINE_KEY);
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }

    function saveOfficeScanBaseline(baseline) {
      if (typeof window === "undefined") {
        return;
      }

      try {
        window.localStorage.setItem(OFFICE_BASELINE_KEY, JSON.stringify(baseline));
      } catch {
        // ignore failures
      }
    }

    const baselineRef = { current: loadOfficeScanBaseline() };

    const unsubscribe = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const visitorList = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setVisitors(visitorList);
      const now = Date.now();
      const issuedAlertKeys = new Set();

      visitorList.forEach((visitor) => {
        const key = getVisitorLocationKey(visitor);
        const status = (visitor.status || "").toString().toLowerCase();
        const visitorEndTime = Number(visitor.endTime || 0);
        const hasExceededTime = visitorEndTime > 0 && visitorEndTime <= now;
        const lastSeenMillis = getTimestampMillis(visitor.lastSeen);
        const officeScanKey = key === "office" && lastSeenMillis ? `${visitor.id}_${lastSeenMillis}` : null;
        const persistedOfficeScanKey = Object.prototype.hasOwnProperty.call(baselineRef.current, visitor.id)
          ? baselineRef.current[visitor.id]
          : null;

        const isNewOfficeScan = officeScanKey && officeScanKey !== persistedOfficeScanKey;

        if (hasLoadedInitialSnapshot.current && isNewOfficeScan && !hasExceededTime && status === "active") {
          const officeAlertKey = `office_${officeScanKey}`;

          if (!isAlertAcknowledged(officeAlertKey) && !issuedAlertKeys.has(officeAlertKey)) {
            const visitorName = visitor.name || visitor.id;
            const text = `Our visitor ${visitorName}, scan by the office reader — keep watching.`;
            pushSecurityAlert({ id: officeAlertKey, text, type: "office" });
            issuedAlertKeys.add(officeAlertKey);
          }
        }
      });

      visitorList.forEach((visitor) => {
        const lastSeenMillis = getTimestampMillis(visitor.lastSeen);
        const key = getVisitorLocationKey(visitor);
        const officeScanKey = key === "office" && lastSeenMillis ? `${visitor.id}_${lastSeenMillis}` : null;

        previousVisitorSnapshotRef.current[visitor.id] = {
          officeScanKey,
          lastSeenMillis,
          currentLocation: visitor.currentLocation,
          location: visitor.location,
        };

        baselineRef.current[visitor.id] = officeScanKey;
      });

      Object.keys(previousVisitorSnapshotRef.current).forEach((id) => {
        if (!visitorList.find((item) => item.id === id)) {
          delete previousVisitorSnapshotRef.current[id];
          delete baselineRef.current[id];
        }
      });

      if (!hasLoadedInitialSnapshot.current) {
        hasLoadedInitialSnapshot.current = true;
      }

      saveOfficeScanBaseline(baselineRef.current);
    });

    return () => unsubscribe();
  }, []);

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

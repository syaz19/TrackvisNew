
import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { db } from "../firebase";
import { useSecurityAlert } from "./SecurityAlertContext";



function SecurityPopup({ alerts, onDismiss }) {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(function () {
    if (!alerts || alerts.length === 0) {
      return undefined;
    }

    const timer = setInterval(function () {
      setCurrentTime(Date.now());
    }, 100);

    return function () {
      clearInterval(timer);
    };
  }, [alerts]);

  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div style={{ position: "fixed", top: 16, right: 16, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, zIndex: 200000, pointerEvents: "none", width: "min(360px, calc(100vw - 32px))" }}>
      {alerts.map(function (alert) {
        return (
          <div key={alert.id} style={{ pointerEvents: "auto", position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-start", gap: 12, width: "100%", boxSizing: "border-box", background: "#171A35", borderRadius: 8, boxShadow: "0 12px 30px rgba(9,13,26,0.35)", border: "1px solid #2A3150", padding: "14px 12px 14px 16px" }}>
            <p style={{ flex: 1, margin: 0, color: "#fff", fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.4 }}>{alert.text}</p>
            <button type="button" aria-label="Dismiss notification" onClick={function () {
              onDismiss(alert.id);
            }} style={{ flex: "0 0 auto", background: "transparent", border: "none", color: "#AAB2D5", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: "1.2rem", lineHeight: 1 }}>X</button>
            <div aria-hidden="true" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 3, background: "#6366F1", transformOrigin: "left", animation: "toast-progress 5s linear forwards", animationDelay: `-${Math.min(Math.max(currentTime - alert.createdAt, 0), 5000)}ms` }} />
          </div>
        );
      })}
    </div>
  );
}


export default function SecurityLayout({ children, currentUser, userData, hideTitle, hideSubtitle, isSmallTitle, title }) {
  
  const [menuOpen, setMenuOpen] = useState(false);

  
  const { alerts: securityAlerts, pushSecurityAlert, dismissAlert, isAlertAcknowledged } = useSecurityAlert();

  
  const [visitors, setVisitors] = useState([]);

  
  const currentTimeRef = useRef(0);

  
  useEffect(function () {
    currentTimeRef.current = Date.now();
  }, []);

  
  
  useEffect(function () {
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

  
  useEffect(() => {
    const timer = setInterval(function () {
      currentTimeRef.current = Date.now();
    }, 1000);

    return function () {
      clearInterval(timer);
    };
  }, []);

  
  useEffect(function () {
    const checkTimer = setInterval(function () {
      const now = currentTimeRef.current;

      visitors.forEach(function (visitor) {
        const status = (visitor.status || "").toString().toLowerCase();
        const visitorEndTime = Number(visitor.endTime || 0);
        const hasExceededTime = visitorEndTime > 0 && visitorEndTime <= now;

        
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

    return function () {
      clearInterval(checkTimer);
    };
  }, [visitors, isAlertAcknowledged, pushSecurityAlert]);

  
  function handleAlertDismiss(alertId) {
    dismissAlert(alertId);
  }

  
  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  
  function closeMenu() {
    setMenuOpen(false);
  }

  
  function handleMainClick() {
    if (menuOpen) {
      closeMenu();
    }
  }

  
  return (
    <div className="container security-container">
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

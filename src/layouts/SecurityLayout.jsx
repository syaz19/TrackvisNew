// SecurityLayout: layout wrapper para sa security staff pages
// Nagpo-provide ng Sidebar (role=security) at Topbar na naka-configure para sa security
import { useState, useEffect, useRef, useCallback } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { db } from "../firebase";

// SecurityPopup:
// Ito ang floating alert box na lumalabas sa taas ng screen.
// Ginagamit ito para magpakita ng mga paalala gaya ng "visitor exceed time".
// Kung walang alert, hindi ito magpapakita ng kahit ano.
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

// SecurityLayout:
// Ito ang main wrapper para sa lahat ng page na para sa security staff.
// Pinag-aayos nito ang sidebar, topbar, at ang content ng page.
// Kailangan nito ang currentUser at userData para ma-display ang tamang user info.
export default function SecurityLayout({ children, currentUser, userData, hideTitle, hideSubtitle, isSmallTitle, title }) {
  // menuOpen: boolean para malaman kung bukas o sarado ang mobile sidebar.
  // Kung true, makikita ang menu; kung false, nakatago ito.
  const [menuOpen, setMenuOpen] = useState(false);

  // securityAlerts: listahan ng mga paalala na dapat ipakita sa screen.
  // Halimbawa: visitor ay lumagpas na sa oras.
  const [securityAlerts, setSecurityAlerts] = useState([]);

  // visitors: listahan ng lahat ng visitor na nasa database.
  // Ginagamit ito para i-check kung may visitor na lumagpas na sa endTime.
  const [visitors, setVisitors] = useState([]);

  // currentTimeRef: timestamp ng oras ngayon.
  // Ginagamit ito para ma-compare ang oras ng visitor sa kasalukuyang oras.
  const currentTimeRef = useRef(0);

  // useEffect na ito ay tatakbo once lang sa simula.
  // Itinatakda ang currentTimeRef sa kasalukuyang timestamp.
  useEffect(() => {
    currentTimeRef.current = Date.now();
  }, []);

  // getAcknowledgedAlerts:
  // Binabasa ang mga alert na nakitang "OK" na ng user sa localStorage.
  // Kaya hindi uulit-ulit ang parehong alert sa tuwing i-refresh ang page.
  const getAcknowledgedAlerts = useCallback(function () {
    try {
      const stored = localStorage.getItem("acknowledgedAlerts");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  // setAlertAcknowledged:
  // Itinatakda ang alert bilang na-acknowledge na.
  // Kaya kapag may alert na na-click ang OK, hindi na ito mauulit.
  const setAlertAcknowledged = useCallback(function (alertKey) {
    const acknowledged = getAcknowledgedAlerts();
    acknowledged[alertKey] = true;
    localStorage.setItem("acknowledgedAlerts", JSON.stringify(acknowledged));
  }, [getAcknowledgedAlerts]);

  // isAlertAcknowledged:
  // Tinitingnan kung ang alert ay na-acknowledge na.
  const isAlertAcknowledged = useCallback(function (alertKey) {
    const acknowledged = getAcknowledgedAlerts();
    return acknowledged[alertKey] === true;
  }, [getAcknowledgedAlerts]);

  // pushSecurityAlert:
  // Dito idinadagdag ang bagong alert sa list.
  // Kung pareho na ang alert ID, hindi ito ma-double add.
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

  // useEffect na ito ay naka-listen sa Firestore visitors collection.
  // Kung may pagbabago sa visitor data, awtomatikong i-update ang visitors state.
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

  // useEffect na ito ay nagre-refresh ng oras bawat 1 segundo.
  // Para ma-check kung na-expire na ang time of visitor.
  useEffect(() => {
    const timer = setInterval(() => {
      currentTimeRef.current = Date.now();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // useEffect na ito ay nagsusuri ng mga active visitor bawat segundo.
  // Kung ang visitor status ay active at ang endTime ay mas maaga or equal sa current time,
  // maglalabas ito ng alert na nagsasabing na-exceed na ang oras nila.
  useEffect(() => {
    const checkTimer = setInterval(() => {
      const now = currentTimeRef.current;

      visitors.forEach((visitor) => {
        const status = (visitor.status || "").toString().toLowerCase();
        const visitorEndTime = Number(visitor.endTime || 0);
        const hasExceededTime = visitorEndTime > 0 && visitorEndTime <= now;

        // Kapag active ang visitor at tapos na ang oras niya,
        // magpapakita ng alert maliban kung na-acknowledge na.
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

  // handleAlertDismiss:
  // Kapag pinindot ang OK sa alert, ito ang magtatakda na na-acknowledge na ang alert.
  // At aalisin din ito sa list para mawala sa screen.
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

  // toggleMenu:
  // Ginagamit ito kapag pinindot ang menu button sa mobile.
  // Switchover lang ang state ng menu: open o close.
  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  // closeMenu:
  // Isinara ang sidebar menu.
  function closeMenu() {
    setMenuOpen(false);
  }

  // handleMainClick:
  // Kapag may pinindot ang user sa main content at bukas ang sidebar,
  // isasara agad ang menu para hindi mag-overlap.
  function handleMainClick() {
    if (menuOpen) {
      closeMenu();
    }
  }

  // Render layout:
  // Side menu at topbar ang laging nakabukas sa page.
  // Ang mga child pages ay ilalagay sa center content area.
  // Ang alert popup ay nasa pinakataas ng screen para magpapaalala.
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

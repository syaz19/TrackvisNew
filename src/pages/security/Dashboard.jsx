import { useState, useEffect, useMemo } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function Dashboard() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setVisitors(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const getViolationType = (visitor, timeValue) => {
    const isConfirmed = visitor.confirmStatus === "Done";
    const originalEndTime = Number(visitor.endTime || 0);
    const exceededTime = originalEndTime > 0 && originalEndTime <= Number(timeValue || 0);

    if (!isConfirmed && exceededTime) return "Both";
    if (!isConfirmed) return "No Confirmation";
    if (exceededTime) return "Exceed Time";
    return "";
  };

  useEffect(() => {
    const interval = setInterval(() => {
      visitors.forEach(async (v) => {
        if (v.status === "active" && v.endTime <= currentTime) {
          try {
            const violationType = getViolationType(v, currentTime);
            await updateDoc(doc(db, "visitors", v.id), {
              status: "expired",
              timeOut: currentTime,
              lastSeen: currentTime,
              violationType
            });
            // Release RFID tag back to available when visitor expires
            if (v.uid) {
              try {
                await updateDoc(doc(db, "rfid_tags", v.uid), {
                  Status: "Available",
                  UsedBy: "",
                  assignedAt: null
                });
              } catch (e) {
                console.warn("Failed to release RFID tag on expire:", e);
              }
            }
          } catch (e) {
            console.warn("Failed to mark visitor expired:", e);
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visitors, currentTime]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const getRemainingTime = (endTime) => {
    const diff = endTime - currentTime;
    if (diff <= 0) return "0m 0s";
    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `${minutes}m ${seconds}s`;
  };

  const getRemainingMinutes = (endTime) => {
    return (endTime - currentTime) / 60000;
  };

  const renderDuration = (value, unit) => {
    const unitLabel = unit === "seconds" ? "sec" : unit === "minutes" ? "min" : "hr";
    return `${value} ${unitLabel}${value === 1 ? "" : "s"}`;
  };

  const isWarning = (endTime) => {
    const remaining = getRemainingMinutes(endTime);
    return remaining <= 5 && remaining > 0;
  };

  const isExpired = (endTime) => {
    return endTime <= currentTime;
  };

  const deactivateVisitor = async (visitor) => {
    try {
      const isConfirmed = visitor.confirmStatus === "Done";
      const violationType = getViolationType(visitor, currentTime);
      await updateDoc(doc(db, "visitors", visitor.id), {
        status: isConfirmed ? "deactivated" : "expired",
        endTime: visitor.endTime || currentTime,
        timeOut: currentTime,
        violationType: isConfirmed ? "" : violationType
      });
      // Release RFID tag when visitor is deactivated/expired
      if (visitor.uid) {
        try {
          await updateDoc(doc(db, "rfid_tags", visitor.uid), {
            Status: "Available",
            UsedBy: "",
            assignedAt: null
          });
        } catch (e) {
          console.warn("Failed to release RFID tag on deactivate:", e);
        }
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const activeVisitorsList = useMemo(() => visitors.filter((v) => v.status === "active"), [visitors]);

  const activeVisitors = activeVisitorsList.length;
  const violations = visitors.filter((v) => v.status === "expired").length;
  const today = new Date(currentTime).toDateString();
  const todayVisitors = visitors.filter(
    (v) => new Date(v.startTime).toDateString() === today
  ).length;


  return (
    <div className="page-grid">
      <section className="card highlight-card">
        <p className="section-kicker">Live overview</p>
        <h3>Active Visitors</h3>
        <p className="metric">{activeVisitors}</p>
      </section>
      <section className="card highlight-card">
        <p className="section-kicker">Safety</p>
        <h3>Violations (Overstay)</h3>
        <p className="metric red">{violations}</p>
      </section>
      <section className="card highlight-card">
        <p className="section-kicker">Today</p>
        <h3>Today&apos;s Visitors</h3>
        <p className="metric">{todayVisitors}</p>
      </section>

      <section className="card summary-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Status</p>
            <h3>Visitor Operations</h3>
          </div>
          <span className="status-pill status-pill--active">{activeVisitors} on site</span>
        </div>
        {loading ? (
          <p className="empty-state">Loading visitors...</p>
        ) : activeVisitors === 0 ? (
          <p className="empty-state">No active visitors yet — registration is ready.</p>
        ) : (
          <p className="section-note">Visitors currently checked in and awaiting processing.</p>
        )}
      </section>

      <section className="card summary-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Analytics</p>
            <h3>Growth Summary</h3>
          </div>
        </div>
        <div className="section-note">Growth analytics have moved to the Growth page for easier review.</div>
      </section>

      <section className="card summary-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Active list</p>
            <h3>Current Visitors</h3>
          </div>
          <span className="status-pill status-pill--active">{activeVisitorsList.length} active</span>
        </div>

        {activeVisitorsList.length === 0 ? (
          <div className="empty-state">No active visitors right now.</div>
        ) : (
          <div className="visitor-list">
            {activeVisitorsList.map((v) => (
              <article
                key={v.id}
                className={`visitor-card ${isExpired(v.endTime) ? "visitor-card--danger" : isWarning(v.endTime) ? "visitor-card--warning" : "visitor-card--active"}`}
              >
                <div className="visitor-card__top">
                  <div>
                    <h4 className="visitor-card__title">{v.name}</h4>
                    <p className="visitor-card__subtitle">{v.purpose}</p>
                  </div>
                  <span className={`status-pill ${isExpired(v.endTime) ? "status-pill--expired" : isWarning(v.endTime) ? "status-pill--warning" : "status-pill--active"}`}>
                    {isExpired(v.endTime) ? "Expired" : isWarning(v.endTime) ? "Warning" : "Active"}
                  </span>
                </div>

                <div className="visitor-meta">
                  <span>📍 {v.location || "Entrance"}</span>
                  <span>🎯 {v.destination}</span>
                  <span>✓ Confirm: {v.confirmStatus === "Done" ? "Done" : "Pending"}</span>
                  <span>🕒 Time In: {v.timeIn ? new Date(v.timeIn).toLocaleTimeString() : "N/A"}</span>
                  <span>⏱ Duration: {renderDuration(v.duration, v.durationUnit || "minutes")}</span>
                  <span>⏳ Time Left: {getRemainingTime(v.endTime)}</span>
                </div>

                {isWarning(v.endTime) && <p className="alert-text">⚠ Less than 5 minutes left.</p>}
                {isExpired(v.endTime) && <p className="alert-text alert-text--danger">🔴 Visitor has expired.</p>}

                <div className="visitor-actions">
                  <button className="action-button action-button--danger" onClick={() => deactivateVisitor(v)}>
                    Deactivate
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}


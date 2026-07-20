import { useState, useEffect } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function Dashboard() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      setVisitors(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  function getViolationType(visitor, timeValue) {
    const isConfirmed = visitor.confirmStatus === "Done";
    const originalEndTime = Number(visitor.endTime || 0);
    const exceededTime = originalEndTime > 0 && originalEndTime <= Number(timeValue || 0);

    if (!isConfirmed && exceededTime) {
      return "Both";
    }

    if (!isConfirmed) {
      return "No Confirmation";
    }

    if (exceededTime) {
      return "Exceed Time";
    }

    return "";
  }

  useEffect(() => {
    const timer = setInterval(() => {
      visitors.forEach(async (visitor) => {
        if (visitor.status === "active" && visitor.endTime <= currentTime) {
          try {
            const violationType = getViolationType(visitor, currentTime);

            await updateDoc(doc(db, "visitors", visitor.id), {
              status: "expired",
              timeOut: currentTime,
              lastSeen: currentTime,
              violationType
            });

            if (visitor.uid) {
              try {
                await updateDoc(doc(db, "rfid_tags", visitor.uid), {
                  Status: "Available",
                  UsedBy: "",
                  assignedAt: null
                });
              } catch (error) {
                console.warn("Failed to release RFID tag on expire:", error);
              }
            }
          } catch (error) {
            console.warn("Failed to mark visitor expired:", error);
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visitors, currentTime]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);

    const clock = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, []);

  function getRemainingTime(endTime) {
    const diff = endTime - currentTime;

    if (diff <= 0) {
      return "0m 0s";
    }

    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `${minutes}m ${seconds}s`;
  }

  function getRemainingMinutes(endTime) {
    return (endTime - currentTime) / 60000;
  }

  function renderDuration(value, unit) {
    const unitLabel = unit === "seconds" ? "sec" : unit === "minutes" ? "min" : "hr";
    return `${value} ${unitLabel}${value === 1 ? "" : "s"}`;
  }

  function isWarning(endTime) {
    const remaining = getRemainingMinutes(endTime);
    return remaining <= 5 && remaining > 0;
  }

  function isExpired(endTime) {
    return endTime <= currentTime;
  }

  async function deactivateVisitor(visitor) {
    try {
      const isConfirmed = visitor.confirmStatus === "Done";
      const violationType = getViolationType(visitor, currentTime);

      await updateDoc(doc(db, "visitors", visitor.id), {
        status: isConfirmed ? "deactivated" : "expired",
        endTime: visitor.endTime || currentTime,
        timeOut: currentTime,
        violationType: isConfirmed ? "" : violationType
      });

      if (visitor.uid) {
        try {
          await updateDoc(doc(db, "rfid_tags", visitor.uid), {
            Status: "Available",
            UsedBy: "",
            assignedAt: null
          });
        } catch (error) {
          console.warn("Failed to release RFID tag on deactivate:", error);
        }
      }
    } catch (error) {
      alert(error.message);
    }
  }

  const activeVisitorsList = visitors.filter((visitor) => visitor.status === "active");
  const activeVisitors = activeVisitorsList.length;
  const violations = visitors.filter((visitor) => visitor.status === "expired").length;
  const today = new Date(currentTime).toDateString();
  const todayVisitors = visitors.filter((visitor) => new Date(visitor.startTime).toDateString() === today).length;

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
            <p className="section-kicker">Active list</p>
            <h3>Current Visitors</h3>
          </div>
          <span className="status-pill status-pill--active">{activeVisitorsList.length} active</span>
        </div>

        {activeVisitorsList.length === 0 ? (
          <div className="empty-state">No active visitors right now.</div>
        ) : (
          <div className="visitor-list">
            {activeVisitorsList.map((visitor) => (
              <article
                key={visitor.id}
                className={`visitor-card ${isExpired(visitor.endTime) ? "visitor-card--danger" : isWarning(visitor.endTime) ? "visitor-card--warning" : "visitor-card--active"}`}
              >
                <div className="visitor-card__top">
                  <div>
                    <h4 className="visitor-card__title">{visitor.name}</h4>
                    <p className="visitor-card__subtitle">{visitor.purpose}</p>
                  </div>
                  <span className={`status-pill ${isExpired(visitor.endTime) ? "status-pill--expired" : isWarning(visitor.endTime) ? "status-pill--warning" : "status-pill--active"}`}>
                    {isExpired(visitor.endTime) ? "Expired" : isWarning(visitor.endTime) ? "Warning" : "Active"}
                  </span>
                </div>

                <div className="visitor-meta">
                  <span>📍 {visitor.location || "Entrance"}</span>
                  <span>🎯 {visitor.destination}</span>
                  <span>✓ Confirm: {visitor.confirmStatus === "Done" ? "Done" : "Pending"}</span>
                  <span>🕒 Time In: {visitor.timeIn ? new Date(visitor.timeIn).toLocaleTimeString() : "N/A"}</span>
                  <span>⏱ Duration: {renderDuration(visitor.duration, visitor.durationUnit || "minutes")}</span>
                  <span>⏳ Time Left: {getRemainingTime(visitor.endTime)}</span>
                </div>

                {isWarning(visitor.endTime) && <p className="alert-text">⚠ Less than 5 minutes left.</p>}
                {isExpired(visitor.endTime) && <p className="alert-text alert-text--danger">🔴 Visitor has expired.</p>}

                <div className="visitor-actions">
                  <button className="action-button action-button--danger" onClick={() => deactivateVisitor(visitor)}>
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

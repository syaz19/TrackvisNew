import { useState, useEffect } from "react";
import { collection, deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function Dashboard() {
  // I-store ang listahan ng visitors, current user, at ang current time.
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(function () {
    // Pakinggan ang visitors sa Firestore.
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      const visitorList = snapshot.docs.map(function (item) {
        return {
          id: item.id,
          ...item.data()
        };
      });

      setVisitors(visitorList);
      setLoading(false);
    });

    return function () {
      unsubscribe();
    };
  }, []);

  function getViolationType(visitor, timeValue) {
    // Tukuyin ang uri ng violation base sa confirmation at sa end time.
    const isConfirmed = visitor.confirmStatus === "Done";
    const visitorEndTime = Number(visitor.endTime || 0);
    const hasReachedDeadline = visitorEndTime > 0 && visitorEndTime <= Number(timeValue || 0);

    if (!isConfirmed && hasReachedDeadline) {
      return "Both";
    }

    if (!isConfirmed) {
      return "No Confirmation";
    }

    if (hasReachedDeadline) {
      return "Exceed Time";
    }

    return "";
  }

  async function checkVisitorDeadlines() {
    for (let index = 0; index < visitors.length; index += 1) {
      const visitor = visitors[index];
      const isExpiredVisitor = visitor.status === "active" && visitor.endTime <= currentTime;

      if (!isExpiredVisitor) {
        continue;
      }

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
              assignedAt: null,
              currentLocation: deleteField(),
              lastScan: deleteField(),
              updatedAt: deleteField()
            });
          } catch (error) {
            console.warn("Failed to release RFID tag on expire:", error);
          }
        }
      } catch (error) {
        console.warn("Failed to mark visitor expired:", error);
      }
    }
  }

  useEffect(function () {
    // Suriin ang bawat active visitor kada segundo at i-update ang status pag dating ng deadline.
    const timer = setInterval(function () {
      checkVisitorDeadlines();
    }, 1000);

    return function () {
      clearInterval(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitors, currentTime]);

  useEffect(function () {
    // I-update ang oras sa bawat segundo para sa countdown at status.
    const timer = setTimeout(function () {
      setCurrentTime(Date.now());
    }, 0);

    const clock = setInterval(function () {
      setCurrentTime(Date.now());
    }, 1000);

    return function () {
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, []);

  function getRemainingTime(endTime) {
    // I-convert ang natitirang oras sa text format para sa UI.
    const difference = endTime - currentTime;

    if (difference <= 0) {
      return "0m 0s";
    }

    const minutes = Math.floor(difference / 1000 / 60);
    const seconds = Math.floor((difference / 1000) % 60);
    return `${minutes}m ${seconds}s`;
  }

  function getRemainingMinutes(endTime) {
    return (endTime - currentTime) / 60000;
  }

  function renderDuration(value, unit) {
    let unitLabel = "hr";

    if (unit === "seconds") {
      unitLabel = "sec";
    } else if (unit === "minutes") {
      unitLabel = "min";
    }

    let suffix = "s";

    if (value === 1) {
      suffix = "";
    }

    return `${value} ${unitLabel}${suffix}`;
  }

  function isWarning(endTime) {
    const remainingMinutes = getRemainingMinutes(endTime);
    return remainingMinutes <= 5 && remainingMinutes > 0;
  }

  function isExpired(endTime) {
    return endTime <= currentTime;
  }

  async function deactivateVisitor(visitor) {
    // Step 1: tukuyin kung confirmed ba ang visitor.
    // Step 2: i-update ang visitor status sa Firestore.
    // Step 3: i-release ang RFID tag para maging available ulit.
    try {
      const isConfirmed = visitor.confirmStatus === "Done";
      const violationType = getViolationType(visitor, currentTime);
      const nextStatus = isConfirmed ? "deactivated" : "expired";

      await updateDoc(doc(db, "visitors", visitor.id), {
        status: nextStatus,
        endTime: visitor.endTime || currentTime,
        timeOut: currentTime,
        violationType: isConfirmed ? "" : violationType
      });

      if (visitor.uid) {
        try {
          await updateDoc(doc(db, "rfid_tags", visitor.uid), {
            Status: "Available",
            UsedBy: "",
            assignedAt: null,
            currentLocation: deleteField(),
            lastScan: deleteField(),
            updatedAt: deleteField()
          });
        } catch (error) {
          console.warn("Failed to release RFID tag on deactivate:", error);
        }
      }
    } catch (error) {
      alert(error.message);
    }
  }

  function handleDeactivateButtonClick(visitor) {
    deactivateVisitor(visitor);
  }

  const activeVisitorsList = visitors.filter(function (visitor) {
    return visitor.status === "active";
  });
  const activeVisitorsCount = activeVisitorsList.length;
  const violationsCount = visitors.filter(function (visitor) {
    return visitor.status === "expired";
  }).length;
  const todayLabel = new Date(currentTime).toDateString();
  const todayVisitorsCount = visitors.filter(function (visitor) {
    return new Date(visitor.startTime).toDateString() === todayLabel;
  }).length;

  if (loading) {
    return (
      <div className="page-card">
        <div className="card">
          <p className="empty-state">Loading live visitor data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="card highlight-card">
        <p className="section-kicker">Live overview</p>
        <h3>Active Visitors</h3>
        <p className="metric">{activeVisitorsCount}</p>
      </section>
      <section className="card highlight-card">
        <p className="section-kicker">Safety</p>
        <h3>Violations (Overstay)</h3>
        <p className="metric red">{violationsCount}</p>
      </section>
      <section className="card highlight-card">
        <p className="section-kicker">Today</p>
        <h3>Today&apos;s Visitors</h3>
        <p className="metric">{todayVisitorsCount}</p>
      </section>

      <section className="card summary-card large-panel security-active-card">
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
          <div className="visitor-list visitor-list-scroll">
            {activeVisitorsList.map(function (visitor) {
              let cardClassName = "visitor-card visitor-card--active";
              let statusLabel = "Active";
              let statusClassName = "status-pill status-pill--active";
              const isAlreadyExpired = isExpired(visitor.endTime);
              const isNearWarning = isWarning(visitor.endTime);

              if (isAlreadyExpired) {
                cardClassName = "visitor-card visitor-card--danger";
                statusLabel = "Expired";
                statusClassName = "status-pill status-pill--expired";
              } else if (isNearWarning) {
                cardClassName = "visitor-card visitor-card--warning";
                statusLabel = "Warning";
                statusClassName = "status-pill status-pill--warning";
              }

              let confirmLabel = "Pending";

              if (visitor.confirmStatus === "Done") {
                confirmLabel = "Done";
              }

              let timeInLabel = "N/A";

              if (visitor.timeIn) {
                timeInLabel = new Date(visitor.timeIn).toLocaleTimeString();
              }

              return (
                <article key={visitor.id} className={cardClassName}>
                  <div className="visitor-card__top">
                    <div>
                      <h4 className="visitor-card__title">{visitor.name}</h4>
                      <p className="visitor-card__subtitle">{visitor.purpose}</p>
                    </div>
                    <span className={statusClassName}>{statusLabel}</span>
                  </div>

                  <div className="visitor-meta">
                    <span>🪪 UID/EPC: {visitor.uid || visitor.epc || "N/A"}</span>
                    <span>📍 {visitor.location || "Entrance"}</span>
                    <span>🎯 {visitor.destination}</span>
                    <span>✓ Confirm: {confirmLabel}</span>
                    <span>🕒 Time In: {timeInLabel}</span>
                    <span>⏱ Duration: {renderDuration(visitor.duration, visitor.durationUnit || "minutes")}</span>
                    <span>⏳ Time Left: {getRemainingTime(visitor.endTime)}</span>
                  </div>

                  {isNearWarning && <p className="alert-text">⚠ Less than 5 minutes left.</p>}
                  {isAlreadyExpired && <p className="alert-text alert-text--danger">🔴 Visitor has expired.</p>}

                  <div className="visitor-actions">
                    <button className="action-button action-button--danger" onClick={function () {
                      handleDeactivateButtonClick(visitor);
                    }}>
                      Deactivate
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

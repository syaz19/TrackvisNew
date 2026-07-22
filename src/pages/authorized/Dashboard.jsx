import { useState, useEffect } from "react";
import { collection, onSnapshot, updateDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebase";

export default function Dashboard() {
  // I-store ang listahan ng visitors, loading state, at user data.
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(function () {
    // Kunin ang active user at ang role data sa Firestore.
    const currentUser = auth.currentUser;

    if (!currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    async function loadUserData() {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.email));

        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, []);

  useEffect(function () {
    // I-filter ang visitors para sa authorized role ng logged-in user.
    if (!userData || !userData.subRole) {
      return;
    }

    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      const visitorList = snapshot.docs
        .map(function (item) {
          return {
            id: item.id,
            ...item.data()
          };
        })
        .filter(function (visitor) {
          return visitor.destination === userData.subRole;
        });

      setVisitors(visitorList);
      setLoading(false);
    });

    return function () {
      unsubscribe();
    };
  }, [userData]);

  function isHistoricalVisitor(visitor) {
    // Tukuyin kung ang visitor ay historical record na.
    const status = (visitor.status || "").toLowerCase();
    const knownStatuses = ["deactivated", "expired", "completed", "done", "inactive", "cancelled"];

    if (knownStatuses.includes(status)) {
      return true;
    }

    return Boolean(visitor.endTime || visitor.timeOut);
  }

  async function handleConfirmVisitor(visitorId) {
    // Step 1: i-update ang confirmation status sa Firestore.
    // Step 2: palitan din ang local state para agad makita ang pagbabago.
    try {
      const currentUser = auth.currentUser;
      let confirmedByValue = null;

      if (currentUser) {
        confirmedByValue = currentUser.email;
      }

      await updateDoc(doc(db, "visitors", visitorId), {
        confirmStatus: "Done",
        confirmedAt: serverTimestamp(),
        confirmedBy: confirmedByValue
      });

      setVisitors(function (oldVisitors) {
        return oldVisitors.map(function (visitor) {
          if (visitor.id === visitorId) {
            return {
              ...visitor,
              confirmStatus: "Done",
              confirmedAt: Date.now(),
              confirmedBy: confirmedByValue
            };
          }

          return visitor;
        });
      });
    } catch (error) {
      alert("Error confirming visitor: " + error.message);
    }
  }

  function handleConfirmButtonClick(visitorId) {
    handleConfirmVisitor(visitorId);
  }

  const pendingVisitors = visitors.filter(function (visitor) {
    return visitor.status === "active" && (visitor.confirmStatus || "") !== "Done";
  });

  const confirmedHistory = visitors
    .filter(function (visitor) {
      return visitor.confirmStatus === "Done" || isHistoricalVisitor(visitor);
    })
    .sort(function (first, second) {
      const firstTime = first.confirmedAt || first.endTime || first.startTime || 0;
      const secondTime = second.confirmedAt || second.endTime || second.startTime || 0;
      return secondTime - firstTime;
    });

  if (loading) {
    return (
      <div className="page-card">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div className="card">
        <h1>Authorized Personnel Dashboard</h1>
        <p className="section-note">Review incoming requests and track your confirmed visitors.</p>

        <section className="card summary-card">
          <div className="section-header">
            <div>
              <p className="section-kicker">Pending</p>
              <h3>Incoming Visitor Requests</h3>
            </div>
            <span className="status-pill status-pill--active">{pendingVisitors.length} pending</span>
          </div>

          {pendingVisitors.length === 0 ? (
            <div className="empty-state">No pending visitors for {userData?.subRole || "your role"}.</div>
          ) : (
            <div className="visitor-list">
              {pendingVisitors.map(function (visitor) {
                let confirmLabel = "Awaiting confirmation";

                if (visitor.confirmStatus === "Done") {
                  confirmLabel = "Done";
                }

                let timeInLabel = "N/A";

                if (visitor.timeIn) {
                  timeInLabel = new Date(visitor.timeIn).toLocaleTimeString();
                }

                return (
                  <article key={visitor.id} className="visitor-card visitor-card--active">
                    <div className="visitor-card__top">
                      <div>
                        <h4 className="visitor-card__title">{visitor.name}</h4>
                        <p className="visitor-card__subtitle">{visitor.purpose}</p>
                      </div>
                      <span className="status-pill status-pill--active">Pending</span>
                    </div>

                    <div className="visitor-meta">
                      <span>📍 {visitor.location || "Entrance"}</span>
                      <span>🎯 {visitor.destination}</span>
                      <span>✓ Confirm Status: {confirmLabel}</span>
                      <span>🕒 Time In: {timeInLabel}</span>
                    </div>

                    {visitor.confirmStatus !== "Done" && (
                      <div className="visitor-actions">
                        <button className="action-button action-button--primary" onClick={function () {
                          handleConfirmButtonClick(visitor.id);
                        }}>
                          Confirm Arrival
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card summary-card dashboard-section">
          <div className="section-header">
            <div>
              <p className="section-kicker">History</p>
              <h3>Your Confirmed Visitors</h3>
            </div>
            <span className="status-pill status-pill--done">{confirmedHistory.length} records</span>
          </div>

          {confirmedHistory.length === 0 ? (
            <div className="empty-state">No confirmed visitor history yet.</div>
          ) : (
            <div className="history-grid">
              {confirmedHistory.map(function (visitor) {
                let statusLabel = "Processed";
                let statusClassName = "status-pill status-pill--expired";

                if (visitor.status === "deactivated") {
                  statusLabel = "Completed";
                  statusClassName = "status-pill status-pill--done";
                } else if (visitor.confirmStatus === "Done") {
                  statusLabel = "Confirmed";
                }

                let timeInLabel = "N/A";
                let timeOutLabel = "N/A";

                if (visitor.timeIn) {
                  timeInLabel = new Date(visitor.timeIn).toLocaleString();
                }

                if (visitor.timeOut) {
                  timeOutLabel = new Date(visitor.timeOut).toLocaleString();
                }

                return (
                  <article key={visitor.id} className="visitor-card visitor-card--history">
                    <div className="visitor-card__top">
                      <div>
                        <h4 className="visitor-card__title">{visitor.name}</h4>
                        <p className="visitor-card__subtitle">{visitor.purpose}</p>
                      </div>
                      <span className={statusClassName}>{statusLabel}</span>
                    </div>

                    <div className="visitor-meta">
                      <span>📍 {visitor.location || "Entrance"}</span>
                      <span>🎯 {visitor.destination}</span>
                      <span>🕒 Time In: {timeInLabel}</span>
                      <span>⏱ Time Out: {timeOutLabel}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { collection, onSnapshot, getDoc, doc } from "firebase/firestore";
import { auth, db } from "../../firebase";

function getDestinations(visitor) {
  if (Array.isArray(visitor.destinations)) return visitor.destinations;
  if (Array.isArray(visitor.destination)) return visitor.destination;
  return visitor.destination ? visitor.destination.split(",").map(function (value) { return value.trim(); }).filter(Boolean) : [];
}

function getDestinationConfirmations(visitor) {
  const destinations = getDestinations(visitor);
  if (Array.isArray(visitor.destinationConfirmations)) return visitor.destinationConfirmations;
  return destinations.map(function (destination) {
    return { destination, status: visitor.confirmStatus || "Pending" };
  });
}

function getPurposeLabel(visitor) {
  return visitor.purpose === "School Related" && visitor.schoolPurpose
    ? `School Related - ${visitor.schoolPurpose}`
    : visitor.purpose;
}

export default function History() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(function () {
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

  useEffect(
    function () {
      if (!userData || !userData.subRole) return;

      const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
        const visitorList = snapshot.docs
          .map(function (item) {
            return { id: item.id, ...item.data() };
          })
          .filter(function (v) {
            // Only show School Related visitors for authorized personnel.
            // Personal visitors never require confirmation.
            return (
              v.purpose === "School Related" &&
              getDestinations(v).includes(userData.subRole)
            );
          });

        // keep only confirmed/history items
        const confirmedHistory = visitorList.filter(function (visitor) {
          const status = (visitor.status || "").toLowerCase();
          const knownStatuses = ["deactivated", "expired", "completed", "done", "inactive", "cancelled"];
          if (knownStatuses.includes(status)) return true;
          if (getDestinationConfirmations(visitor).some(function (confirmation) {
            return confirmation.destination === userData.subRole && confirmation.status === "Done";
          })) return true;
          return Boolean(visitor.endTime || visitor.timeOut);
        });

        setVisitors(
          confirmedHistory.sort(function (a, b) {
            const aTime = a.confirmedAt || a.endTime || a.startTime || 0;
            const bTime = b.confirmedAt || b.endTime || b.startTime || 0;
            return bTime - aTime;
          })
        );
      });

      return function () {
        unsubscribe();
      };
    },
    [userData]
  );

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
        <h1>Confirmed Visitor History</h1>
        <p className="section-note">All confirmed and completed visitors for your assigned area.</p>

        {visitors.length === 0 ? (
          <div className="empty-state">No confirmed visitor history yet.</div>
        ) : (
          <div className="history-grid">
            {visitors.map(function (visitor) {
              let statusLabel = "Processed";
              let statusClassName = "status-pill status-pill--expired";
              const ownConfirmation = getDestinationConfirmations(visitor).find(function (confirmation) {
                return confirmation.destination === userData?.subRole;
              });

              const isOwnConfirmationDone = Array.isArray(visitor.destinationConfirmations)
                ? ownConfirmation?.status === "Done"
                : (visitor.confirmStatus || "") === "Done";

              if (isOwnConfirmationDone) {
                statusLabel = "Confirmed";
                statusClassName = "status-pill status-pill--done";
              } else if ((visitor.status || "").toLowerCase() === "deactivated" || (visitor.status || "").toLowerCase() === "expired") {
                statusLabel = "Not Confirmed";
                statusClassName = "status-pill status-pill--expired";
              }

              const timeInLabel = visitor.timeIn ? new Date(visitor.timeIn).toLocaleString() : "N/A";
              const timeOutLabel = visitor.timeOut ? new Date(visitor.timeOut).toLocaleString() : "N/A";

              return (
                <article key={visitor.id} className="visitor-card visitor-card--history">
                  <div className="visitor-card__top">
                    <div>
                      <h4 className="visitor-card__title">{visitor.name}</h4>
                        <p className="visitor-card__subtitle">{getPurposeLabel(visitor)}</p>
                    </div>
                    <span className={statusClassName}>{statusLabel}</span>
                  </div>

                  <div className="visitor-meta">
                    <span>🪪 UID/EPC: {visitor.uid || visitor.epc || "N/A"}</span>
                    <span>📍 {visitor.currentLocation || visitor.location || "Entrance"}</span>
                    <span>🎯 {getDestinations(visitor).join(", ")}</span>
                    {getDestinationConfirmations(visitor).map(function (confirmation) {
                      return <span key={confirmation.destination}>✓ {confirmation.destination} Confirm: {confirmation.status === "Done" ? "Confirmed" : "Pending"}</span>;
                    })}
                    <span>🕒 Time In: {timeInLabel}</span>
                    <span>⏱ Time Out: {timeOutLabel}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

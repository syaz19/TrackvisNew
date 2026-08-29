import { useState, useEffect } from "react";
import { collection, onSnapshot, getDoc, doc } from "firebase/firestore";
import { auth, db } from "../../firebase";

// getDestinations:
// Tinutukoy nito ang lahat ng destination na pupuntahan ng visitor.
// Ginagamit ito para malaman kung para saan ang visitor at kung aling department ang may hawak.
function getDestinations(visitor) {
  if (Array.isArray(visitor.destinations)) return visitor.destinations;
  if (Array.isArray(visitor.destination)) return visitor.destination;
  return visitor.destination ? visitor.destination.split(",").map(function (value) { return value.trim(); }).filter(Boolean) : [];
}

// getDestinationConfirmations:
// Binubuo nito ang listahan ng bawat destination at kung done na ba ang confirmation.
// Kung walang data, default ito sa Pending.
function getDestinationConfirmations(visitor) {
  const destinations = getDestinations(visitor);
  if (Array.isArray(visitor.destinationConfirmations)) return visitor.destinationConfirmations;
  return destinations.map(function (destination) {
    return { destination, status: visitor.confirmStatus || "Pending" };
  });
}

// getPurposeLabel:
// Kung school-related, ipapakita rin ang detalyeng schoolPurpose.
// Para mas malinaw kung ano ang dahilan ng pagbisita.
function getPurposeLabel(visitor) {
  return visitor.purpose === "School Related" && visitor.schoolPurpose
    ? `School Related - ${visitor.schoolPurpose}`
    : visitor.purpose;
}

// History page:
// Ito ang page na nagpapakita ng mga completed o confirmed visitor records ng authorized user.
// Dito nakikita ang history ng mga visitor na may nauugnay na destination sa user.
export default function History() {
  // visitors: listahan ng mga visitor records na may confirmed history.
  const [visitors, setVisitors] = useState([]);

  // loading: ginagamit habang kinukuha ang user at visitor data.
  const [loading, setLoading] = useState(true);

  // userData: data ng kasalukuyang logged-in user mula sa Firestore users collection.
  const [userData, setUserData] = useState(null);

  // useEffect na ito: kunin ang kasalukuyang user at ang user record niya.
  // Kung walang user, hindi na maglo-load ang page.
  useEffect(function () {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      // Walang naka-login, so itigil ang loading.
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

  // useEffect na ito: kapag may userData at subRole, mag-subscribe sa visitors collection.
  // Lang ng School Related visitors na may destination same sa user ang ipapakita.
  useEffect(
    function () {
      if (!userData || !userData.subRole) return;

      const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
        const visitorList = snapshot.docs
          .map(function (item) {
            return { id: item.id, ...item.data() };
          })
          .filter(function (v) {
            // Huwag ipakita ang personal visitors.
            // Tinitingnan lang ang School Related visitors para sa assigned area ng authorized user.
            return (
              v.purpose === "School Related" &&
              getDestinations(v).includes(userData.subRole)
            );
          });

        // confirmedHistory:
        // Ito ang listahan ng mga visitor na nakumpleto na, confirmed na, o may endTime.
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

  // JSX:
  // Ipinapakita ang title, section note, at list ng confirmed history items.
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

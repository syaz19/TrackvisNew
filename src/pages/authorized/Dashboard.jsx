import { useState, useEffect } from "react";
import { collection, onSnapshot, updateDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
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
    return { destination, status: visitor.confirmStatus || "Pending", confirmedAt: visitor.confirmedAt || null, confirmedBy: visitor.confirmedBy || null };
  });
}


function getPurposeLabel(visitor) {
  if (visitor.purpose === "School Related" && visitor.schoolPurpose) {
    return `School Related - ${visitor.schoolPurpose}`;
  }

  return visitor.purpose;
}


export default function Dashboard() {
 
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

  
  useEffect(function () {
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
          return (
            visitor.purpose === "School Related" &&
            getDestinations(visitor).includes(userData.subRole)
          );
        });

      setVisitors(visitorList);
      setLoading(false);
    });

    return function () {
      unsubscribe();
    };
  }, [userData]);

  
  async function handleConfirmVisitor(visitorId) {
    try {
      const currentUser = auth.currentUser;
      let confirmedByValue = null;

      if (currentUser) {
        confirmedByValue = currentUser.email;
      }

      const visitor = visitors.find(function (item) { return item.id === visitorId; });
      const destinationConfirmations = getDestinationConfirmations(visitor).map(function (confirmation) {
        if (confirmation.destination !== userData.subRole) return confirmation;
        return {
          ...confirmation,
          status: "Done",
          confirmedAt: null,
          confirmedBy: confirmedByValue
        };
      });
      const isFullyConfirmed = destinationConfirmations.length > 0 && destinationConfirmations.every(function (confirmation) {
        return confirmation.status === "Done";
      });

      
      await updateDoc(doc(db, "visitors", visitorId), {
        destinationConfirmations,
        confirmStatus: isFullyConfirmed ? "Done" : "Pending",
        completionStatus: isFullyConfirmed ? "Completed" : "Active",
        confirmedAt: isFullyConfirmed ? serverTimestamp() : null,
        confirmedBy: isFullyConfirmed ? confirmedByValue : null
      });
    } catch (error) {
      alert("Error confirming visitor: " + error.message);
    }
  }

  
  function handleConfirmButtonClick(visitorId) {
    handleConfirmVisitor(visitorId);
  }

  
  const pendingVisitors = visitors.filter(function (visitor) {
    const confirmation = getDestinationConfirmations(visitor).find(function (item) {
      return item.destination === (userData ? userData.subRole : undefined);
    });
    return visitor.status === "active" && (!confirmation || confirmation.status !== "Done");
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
            <div className="empty-state">No pending visitors for {(userData && userData.subRole) || "your role"}.</div>
          ) : (
            <div className="visitor-list authorized-pending-grid">
              {pendingVisitors.map(function (visitor) {
                const destinationConfirmations = getDestinationConfirmations(visitor);
                const ownConfirmation = destinationConfirmations.find(function (item) {
                  return item.destination === (userData ? userData.subRole : undefined);
                });

                let timeInLabel = "N/A";

                if (visitor.timeIn) {
                  timeInLabel = new Date(visitor.timeIn).toLocaleTimeString();
                }

                return (
                  <article key={visitor.id} className="visitor-card visitor-card--active">
                    <div className="visitor-card__top">
                      <div>
                        <h4 className="visitor-card__title">{visitor.name}</h4>
                        <p className="visitor-card__subtitle">{getPurposeLabel(visitor)}</p>
                      </div>
                      <span className="status-pill status-pill--active">Pending</span>
                    </div>

                    <div className="visitor-meta">
                      <span>🪪 UID/EPC: {visitor.uid || visitor.epc || "N/A"}</span>
                      <span>📍 {visitor.currentLocation || visitor.location || "Entrance"}</span>
                      <span>🎯 {getDestinations(visitor).join(", ")}</span>
                      {destinationConfirmations.map(function (confirmation) {
                        return <span key={confirmation.destination}>✓ {confirmation.destination} Confirm - {confirmation.status === "Done" ? "Confirmed" : "Pending"}</span>;
                      })}
                      <span>🕒 Time In: {timeInLabel}</span>
                    </div>

                    {(!ownConfirmation || ownConfirmation.status !== "Done") && (
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
      </div>
    </div>
  );
}

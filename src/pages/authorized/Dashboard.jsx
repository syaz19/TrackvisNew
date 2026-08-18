import { useState, useEffect } from "react";
import { collection, onSnapshot, updateDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";

// Authorized Dashboard: ipinapakita ang mga pending visitor requests para sa authorized user's subRole
export default function Dashboard() {
  // visitors: mga visitor records filtered para sa user's subRole
  const [visitors, setVisitors] = useState([]);
  // loading flag habang kinukuha ang user at visitor data
  const [loading, setLoading] = useState(true);
  // userData: ang Firestore `users` document ng kasalukuyang user
  const [userData, setUserData] = useState(null);

  // Effect: kunin ang kasalukuyang auth user at load user document mula sa Firestore
  useEffect(function () {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      // walang naka-login: markahan bilang hindi naglo-load at ibalik
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

  // Effect: kapag may userData at may subRole, mag-subscribe sa `visitors` collection
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
        // Filter para sa School Related visitors na naka-target sa subRole ng authorized user.
        // Personal / Non-School Related visitors ay hindi dapat mag-require ng confirmation.
        .filter(function (visitor) {
          return (
            visitor.purpose === "School Related" &&
            visitor.destination === userData.subRole
          );
        });

      setVisitors(visitorList);
      setLoading(false);
    });

    return function () {
      unsubscribe();
    };
  }, [userData]);

  // historical records are rendered in a separate History page/component

  // Handler para i-confirm ang arrival ng isang visitor
  async function handleConfirmVisitor(visitorId) {
    try {
      const currentUser = auth.currentUser;
      let confirmedByValue = null;

      if (currentUser) {
        confirmedByValue = currentUser.email;
      }

      // Update sa Firestore: markahan ang confirmStatus at timestamp
      await updateDoc(doc(db, "visitors", visitorId), {
        confirmStatus: "Done",
        confirmedAt: serverTimestamp(),
        confirmedBy: confirmedByValue
      });

      // Update local state para mabilis makita ang pagbabago sa UI
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

  // Simple wrapper para tawagin ang confirm handler
  function handleConfirmButtonClick(visitorId) {
    handleConfirmVisitor(visitorId);
  }

  // Filter para sa mga pending visitors na active at hindi pa na-confirm
  const pendingVisitors = visitors.filter(function (visitor) {
    return visitor.status === "active" && (visitor.confirmStatus || "") !== "Done";
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

  // JSX: ipakita ang listahan ng pending visitors at actions
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
                      <span>🪪 UID/EPC: {visitor.uid || visitor.epc || "N/A"}</span>
                      <span>📍 {visitor.currentLocation || visitor.location || "Entrance"}</span>
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
      </div>
    </div>
  );
}

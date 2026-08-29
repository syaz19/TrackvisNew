import { useState, useEffect } from "react";
import { collection, onSnapshot, updateDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";

// getDestinations:
// Tinutukuy kung ano ang destination o lugar na pupuntahan ng visitor.
// Maaaring naka-array ang data o string na may comma-separated values.
function getDestinations(visitor) {
  if (Array.isArray(visitor.destinations)) return visitor.destinations;
  if (Array.isArray(visitor.destination)) return visitor.destination;
  return visitor.destination ? visitor.destination.split(",").map(function (value) { return value.trim(); }).filter(Boolean) : [];
}

// getDestinationConfirmations:
// Ginagawa nitong listahan ang bawat destination at ang status ng confirmation.
// Kung walang record, itutakda itong Pending bilang default value.
function getDestinationConfirmations(visitor) {
  const destinations = getDestinations(visitor);
  if (Array.isArray(visitor.destinationConfirmations)) return visitor.destinationConfirmations;
  return destinations.map(function (destination) {
    return { destination, status: visitor.confirmStatus || "Pending", confirmedAt: visitor.confirmedAt || null, confirmedBy: visitor.confirmedBy || null };
  });
}

// getPurposeLabel:
// Kung ang purpose ay School Related at may schoolPurpose, idinadagdag ito sa label.
// Para mas malinaw kung ano ang dahilan ng pagbisita.
function getPurposeLabel(visitor) {
  return visitor.purpose === "School Related" && visitor.schoolPurpose
    ? `School Related - ${visitor.schoolPurpose}`
    : visitor.purpose;
}

// Authorized Dashboard:
// Ito ang page kung saan tinitingnan ng authorized user ang mga incoming visitor requests.
// Nakikita lang dito ang mga visitor na naka-target sa subRole ng user.
export default function Dashboard() {
  // visitors: listahan ng mga visitor records na dapat makita ng authorized user.
  const [visitors, setVisitors] = useState([]);

  // loading: ginagamit para ipakita ang loading screen habang kinukuha pa ang data.
  const [loading, setLoading] = useState(true);

  // userData: ang data ng kasalukuyang logged-in user mula sa Firestore users collection.
  const [userData, setUserData] = useState(null);

  // useEffect na ito: kunin ang kasalukuyang logged-in user at ang user document niya.
  // Kung walang user, walang loading at diretso nang mag-return.
  useEffect(function () {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      // Walang naka-login: itigil ang loading at tapusin na.
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

  // useEffect na ito: kapag may userData at may subRole, mag-subscribe sa visitors collection.
  // Dito lang papasok ang mga School Related visitor na para sa assigned area ng user.
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
        // Filter: tinitingnan lang ang mga School Related visitors na may destination na same sa subRole ng user.
        // Hindi kasama ang personal visitors o ibang department.
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

  // historical records are rendered in a separate History page/component
  // Ang history page ay hiwalay na page. Ito lang ang pending dashboard.

  // handleConfirmVisitor:
  // Kapag may pinindot na Confirm Arrival, update ang visitor record sa Firestore.
  // Itinatakda ang status na Done kung lahat ng destination confirmation ay natapos na.
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

      // Update sa Firestore:
      // - destinationConfirmations: status ng bawat destination
      // - confirmStatus: kung tapos na ang whole process
      // - completionStatus: kapag natapos na, magiging Completed
      // - confirmedAt/confirmedBy: time at user na nag-confirm
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

  // handleConfirmButtonClick:
  // Wrapper lang ito para mas madaling tawagan ang confirm function.
  function handleConfirmButtonClick(visitorId) {
    handleConfirmVisitor(visitorId);
  }

  // pendingVisitors:
  // Ito ang listahan ng mga visitor na active pa at hindi pa confirmed para sa user na ito.
  const pendingVisitors = visitors.filter(function (visitor) {
    const confirmation = getDestinationConfirmations(visitor).find(function (item) {
      return item.destination === userData?.subRole;
    });
    return visitor.status === "active" && confirmation?.status !== "Done";
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

  // JSX: ipinapakita ang listahan ng incoming visitors at button ng confirmation.
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
                const destinationConfirmations = getDestinationConfirmations(visitor);
                const ownConfirmation = destinationConfirmations.find(function (item) {
                  return item.destination === userData?.subRole;
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

                    {ownConfirmation?.status !== "Done" && (
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

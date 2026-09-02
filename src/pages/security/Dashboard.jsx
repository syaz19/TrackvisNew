/**
 * pages/security/Dashboard.jsx
 *
 * Layunin: Dashboard para sa `security` role.
 * - Naka-list ang mga active visitors, may countdown para sa bawat visitor end time, at nagmamarka ng `expired` kapag lumampas ang oras.
 * - Nagre-release ng RFID tag kapag nag-expire ang visitor (update sa `rfid_tags`).
 * - Bahagi ng app: security operations at realtime monitoring ng `visitors` collection.
 *
 * Paano gumagana:
 * 1. Nag-subscribe sa Firestore `visitors` collection at ina-update ang lokal na list.
 * 2. May timer na nagche-check kada segundo para markahan ang expired visitors at i-update ang Firestore.
 * 3. Nagbibigay ng UI para i-manage at suriin ang visitor list.
 */
// I-import ang hooks na kailangan para magamit ang state at effect sa component.
import { useState, useEffect } from "react";
// I-import ang Firestore helpers para makapag-read at makapag-update ng data sa database.
import { collection, deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
// I-import ang Firestore instance na naka-connect sa app.
import { db } from "../../firebase";

// getDestinations:
// Tinutukoy nito kung saan pupunta ang visitor.
// Pwede itong maging array o kaya string na may comma.
// Ginagamit ito para malaman ang destination list sa dashboard.
function getDestinations(visitor) {
  if (Array.isArray(visitor.destinations)) return visitor.destinations;
  if (Array.isArray(visitor.destination)) return visitor.destination;
  return visitor.destination ? visitor.destination.split(",").map(function (value) { return value.trim(); }).filter(Boolean) : [];
}

// getDestinationConfirmations:
// Ginagawa nitong listahan ang bawat destination at ang status nitong confirmation.
// Kung wala pang data, default na Pending ang status.
function getDestinationConfirmations(visitor) {
  const destinations = getDestinations(visitor);
  if (Array.isArray(visitor.destinationConfirmations)) return visitor.destinationConfirmations;
  return destinations.map(function (destination) {
    return { destination, status: visitor.confirmStatus || "Pending" };
  });
}

function isFullyConfirmed(visitor) {
  if (visitor.purpose === "Personal / Non-School Related") return true;
  const confirmations = getDestinationConfirmations(visitor);
  return confirmations.length > 0 && confirmations.every(function (confirmation) {
    return confirmation.status === "Done";
  });
}

function getSchoolConfirmationState(visitor) {
  const confirmations = getDestinationConfirmations(visitor);
  const confirmedCount = confirmations.filter(function (confirmation) {
    return confirmation.status === "Done";
  }).length;

  return {
    total: confirmations.length,
    confirmed: confirmedCount,
    isFullyConfirmed: confirmations.length > 0 && confirmedCount === confirmations.length,
    hasSomeConfirmation: confirmedCount > 0
  };
}

function getPurposeLabel(visitor) {
  return visitor.purpose === "School Related" && visitor.schoolPurpose
    ? `School Related - ${visitor.schoolPurpose}`
    : visitor.purpose;
}

// I-declare ang default export na siyang component na ipinapakita sa page.
export default function Dashboard() {
  // I-store ang listahan ng visitors, ang loading state, at ang kasalukuyang oras.
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  // I-store ang selected visitor category tab.
  const [selectedCategory, setSelectedCategory] = useState("Personal / Non-School Related");

  // I-set up ang listener para sa live updates sa visitors collection.
  useEffect(function () {
    // Pinapakinggan ang pagbabago sa Firestore upang laging updated ang listahan.
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      // Ginagawa ang array ng visitor objects mula sa snapshot.
      const visitorList = snapshot.docs.map(function (item) {
        return {
          id: item.id,
          ...item.data()
        };
      });

      // Ini-update ang state para maipakita ang bagong data sa UI.
      setVisitors(visitorList);
      setLoading(false);
    });

    // Ibinabalik ang cleanup function para ihinto ang listener kapag hindi na ginagamit ang component.
    return function () {
      unsubscribe();
    };
  }, []);

  // I-define ang function na nag-uuri kung may violation ba ang visitor.
  function getViolationType(visitor, timeValue) {
    // Para sa Personal / Non-School Related visitors, walang confirmation requirement.
    // Kaya ang ONLY possible violation ay Time Exceeded.
    if (visitor.purpose === "Personal / Non-School Related") {
      // I-convert ang endTime sa number para maihambing sa current time.
      const visitorEndTime = Number(visitor.endTime || 0);
      // Sinusuri kung naabot na ang deadline base sa end time at current time.
      const hasReachedDeadline = visitorEndTime > 0 && visitorEndTime <= Number(timeValue || 0);

      // Kung lumampas na sa oras, ipinapakita ang Time Exceeded violation.
      if (hasReachedDeadline) {
        return "Time Exceeded";
      }

      // Kung walang violation, ibinabalik ang empty string.
      return "";
    }

    // Para sa School Related visitors, check both confirmation at time.
    if (visitor.purpose === "School Related") {
      const confirmationState = getSchoolConfirmationState(visitor);
      // I-convert ang endTime sa number para maihambing sa current time.
      const visitorEndTime = Number(visitor.endTime || 0);
      // Sinusuri kung naabot na ang deadline base sa end time at current time.
      const hasReachedDeadline = visitorEndTime > 0 && visitorEndTime <= Number(timeValue || 0);

      if (!hasReachedDeadline) {
        return confirmationState.isFullyConfirmed
          ? ""
          : confirmationState.hasSomeConfirmation
          ? "Uncomplete Confirmation"
          : "No Confirmation";
      }

      if (confirmationState.isFullyConfirmed) {
        return "Time Exceeded";
      }

      return confirmationState.hasSomeConfirmation
        ? "Uncomplete Confirmation and Time Exceed"
        : "No Confirmation and Time Exceed";
    }

    // Default: walang violation type detected.
    return "";
  }

  // Removed: automatic visitor expiration. Security staff must manually deactivate visitors.
  // Visitors now remain active and visible in the 3D model even after time exceeds,
  // allowing security to monitor them until manually deactivating.

  // Deadline checker removed - no automatic expiration. Security staff controls visitor status.

  // I-update ang current time para sa countdown at expiration logic.
  useEffect(function () {
    // I-set ang initial time sa unang render.
    const timer = setTimeout(function () {
      setCurrentTime(Date.now());
    }, 0);

    // I-update ang oras sa bawat segundo para laging updated ang countdown.
    const clock = setInterval(function () {
      setCurrentTime(Date.now());
    }, 1000);

    // I-clear ang timeout at interval kapag hindi na kailangan.
    return function () {
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, []);

  // I-convert ang natitirang oras sa text na madaling makita sa UI.
  function getRemainingTime(endTime) {
    // Kinukwenta ang difference sa pagitan ng end time at current time.
    const difference = endTime - currentTime;

    // Kung naubos na ang oras, ipinapakita ang zero time.
    if (difference <= 0) {
      return "0m 0s";
    }

    // Kinukuha ang minuto at segundo na natitira.
    const minutes = Math.floor(difference / 1000 / 60);
    const seconds = Math.floor((difference / 1000) % 60);
    return `${minutes}m ${seconds}s`;
  }

  // I-kalkula ang natitirang minuto para sa warning logic.
  function getRemainingMinutes(endTime) {
    return (endTime - currentTime) / 60000;
  }

  // I-format ang duration sa user-friendly label gaya ng min o sec.
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

  function getDisplayDuration(visitor) {
    if (typeof visitor.durationText === "string" && visitor.durationText.trim()) {
      return visitor.durationText.trim();
    }

    return renderDuration(visitor.duration, visitor.durationUnit || "minutes");
  }

  // I-tiningnan kung malapit na ang visitor sa deadline para mag-show ng warning.
  function isWarning(endTime) {
    const remainingMinutes = getRemainingMinutes(endTime);
    return remainingMinutes <= 5 && remainingMinutes > 0;
  }

  // I-tiningnan kung expired na ang visitor base sa current time.
  function isExpired(endTime) {
    return endTime <= currentTime;
  }

  // I-deactivate ang visitor kapag pinindot ang button.
  async function deactivateVisitor(visitor) {
    // Step 1: tinitingnan kung confirmed na ang visitor.
    // Step 2: ina-update ang status sa Firestore.
    // Step 3: ini-release ang RFID tag para maging available ulit.
    try {
      // Tinitingnan kung ang visitor ay may confirmation bilang done.
      const isPersonalVisitor = visitor.purpose === "Personal / Non-School Related";
      const hasReachedDeadline = Number(visitor.endTime || 0) <= currentTime;
      const fullyConfirmed = isFullyConfirmed(visitor);

      // Pinapili ang susunod na status depende sa confirmation at visitor type.
      const nextStatus = hasReachedDeadline && (!isPersonalVisitor && !fullyConfirmed || isPersonalVisitor)
        ? "expired"
        : "deactivated";

      // Kung Personal at hindi pa nag-expire, hindi may violation.
      // Kung Personal pero nag-expire na, mag-set ng Time Exceeded violation.
      let violationType = "";
      if (isPersonalVisitor && hasReachedDeadline) {
        violationType = "Time Exceeded";
      } else if (!isPersonalVisitor) {
        // Para sa School Related, compute ang violation base sa confirmation at time.
        violationType = getViolationType(visitor, currentTime);
      }
      // Para sa Personal visitors na manually deactivated bago mag-expire:
      // violationType ay nananatiling "" (empty string, no violation).

      // Ina-update ang visitor status sa database.
      const updateData = {
        status: nextStatus,
        location: "School Exit",
        currentLocation: "School Exit",
        completionStatus: isPersonalVisitor && !hasReachedDeadline || !isPersonalVisitor && fullyConfirmed && !hasReachedDeadline
          ? "Completed"
          : "Violation",
        endTime: visitor.endTime || currentTime,
        timeOut: currentTime
      };
      
      // Kung may violation type, i-save ito. Kung wala, i-set lang ang empty string.
      if (violationType) {
        updateData.violationType = violationType;
      } else {
        updateData.violationType = "";
      }
      
      await updateDoc(doc(db, "visitors", visitor.id), updateData);

      // Kung may UID, ini-release ang RFID tag.
      if (visitor.uid) {
        try {
          // Ina-update ang RFID tag record para maging available ulit.
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

  // I-wrap ang function para madali itong tawagin sa button click.
  function handleDeactivateButtonClick(visitor) {
    deactivateVisitor(visitor);
  }

  // I-filter ang listahan para sa mga active visitor lang.
  const activeVisitorsList = visitors.filter(function (visitor) {
    return visitor.status === "active";
  });
  
  // I-filter ang Personal / Non-School Related visitors.
  const personalVisitors = activeVisitorsList.filter(function (visitor) {
    return visitor.purpose === "Personal / Non-School Related";
  });
  
  // I-filter ang School Related visitors.
  const schoolRelatedVisitors = activeVisitorsList.filter(function (visitor) {
    return visitor.purpose === "School Related";
  });
  
  // I-set ang displayed visitors base sa selected category.
  const displayedVisitors = selectedCategory === "Personal / Non-School Related" 
    ? personalVisitors 
    : schoolRelatedVisitors;
  
  // Kinukuha ang total ng active visitors.
  const activeVisitorsCount = activeVisitorsList.length;
  // Kinukuha ang bilang ng visitors with violations (expired or deactivated with violations).
  const violationsCount = visitors.filter(function (visitor) {
    return visitor.status === "expired" || (visitor.status === "deactivated" && visitor.violationType);
  }).length;
  // Ginagawa ang label ng araw para i-compare ang visitors ngayon.
  const todayLabel = new Date(currentTime).toDateString();
  // I-filter ang visitors na nangyari ngayon.
  const todayVisitorsCount = visitors.filter(function (visitor) {
    return new Date(visitor.startTime).toDateString() === todayLabel;
  }).length;

  // Kung naglo-load pa ang data, ipinapakita ang loading state.
  if (loading) {
    return (
      <div className="page-card">
        <div className="card">
          <p className="empty-state">Loading live visitor data...</p>
        </div>
      </div>
    );
  }

  // I-render ang main dashboard layout kapag handa na ang data.
  return (
    <div className="page-grid">
      <section className="card highlight-card">
        <p className="section-kicker">Live overview</p>
        <h3>Active Visitors</h3>
        <p className="metric">{activeVisitorsCount}</p>
      </section>
      <section className="card highlight-card">
        <p className="section-kicker">Safety</p>
        <h3>Visitor with Violations</h3>
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

        <div className="visitor-category-tabs">
          <button
            className={`category-tab ${selectedCategory === "Personal / Non-School Related" ? "category-tab--active" : ""}`}
            onClick={function () {
              setSelectedCategory("Personal / Non-School Related");
            }}
          >
            Personal / Non-School Related {personalVisitors.length > 0 && `(${personalVisitors.length})`}
          </button>
          <button
            className={`category-tab ${selectedCategory === "School Related" ? "category-tab--active" : ""}`}
            onClick={function () {
              setSelectedCategory("School Related");
            }}
          >
            School Related {schoolRelatedVisitors.length > 0 && `(${schoolRelatedVisitors.length})`}
          </button>
        </div>

        {displayedVisitors.length === 0 ? (
          <div className="empty-state">
            {selectedCategory === "Personal / Non-School Related"
              ? "No personal/non-school related visitors are currently active."
              : "No school-related visitors are currently active."}
          </div>
        ) : (
          <div className="visitor-list visitor-list-scroll">
            {displayedVisitors.map(function (visitor) {
              // I-set ang default style para sa active visitor card.
              let cardClassName = "visitor-card visitor-card--active";
              let statusLabel = "Active";
              let statusClassName = "status-pill status-pill--active";
              // Tinitingnan kung expired na ang visitor.
              const isAlreadyExpired = isExpired(visitor.endTime);
              // Tinitingnan kung malapit na sa deadline para mag-show ng warning.
              const isNearWarning = isWarning(visitor.endTime);

              // Kung expired na, binabago ang card style at label.
              if (isAlreadyExpired) {
                cardClassName = "visitor-card visitor-card--danger";
                statusLabel = "Expired";
                statusClassName = "status-pill status-pill--expired";
              } else if (isNearWarning) {
                cardClassName = "visitor-card visitor-card--warning";
                statusLabel = "Warning";
                statusClassName = "status-pill status-pill--warning";
              }

              let timeInLabel = "N/A";

              // Kung may timeIn value, ipinapakita ang oras sa local time format.
              if (visitor.timeIn) {
                timeInLabel = new Date(visitor.timeIn).toLocaleTimeString();
              }

              return (
                <article key={visitor.id} className={cardClassName}>
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
                    <span>🎯 Destination: {getDestinations(visitor).join(", ") || "N/A"}</span>
                    {visitor.purpose === "Personal / Non-School Related" && <span>✓ Confirmation: Not Required</span>}
                    {visitor.purpose === "School Related" && getDestinationConfirmations(visitor).map(function (confirmation) {
                      return <span key={confirmation.destination}>✓ {confirmation.destination} Confirm - {confirmation.status === "Done" ? "Confirmed" : "Pending"}</span>;
                    })}
                    <span>🕒 Time In: {timeInLabel}</span>
                    <span>⏱ Duration: {getDisplayDuration(visitor)}</span>
                    <span>⌛ Time Left: {getRemainingTime(visitor.endTime)}</span>
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

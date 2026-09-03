
import { useState, useEffect } from "react";

import { collection, deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";

import { db } from "../../firebase";


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
  if (visitor.purpose === "School Related" && visitor.schoolPurpose) {
    return `School Related - ${visitor.schoolPurpose}`;
  }

  return visitor.purpose;
}


export default function Dashboard() {
  
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [selectedCategory, setSelectedCategory] = useState("Personal / Non-School Related");

  
  useEffect(function () {
    
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
    
    if (visitor.purpose === "Personal / Non-School Related") {
      
      const visitorEndTime = Number(visitor.endTime || 0);
      
      const hasReachedDeadline = visitorEndTime > 0 && visitorEndTime <= Number(timeValue || 0);

      
      if (hasReachedDeadline) {
        return "Time Exceeded";
      }

      
      return "";
    }

    
    if (visitor.purpose === "School Related") {
      const confirmationState = getSchoolConfirmationState(visitor);
     
      const visitorEndTime = Number(visitor.endTime || 0);
      
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

  
  useEffect(function () {
    
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

  function getDisplayDuration(visitor) {
    if (typeof visitor.durationText === "string" && visitor.durationText.trim()) {
      return visitor.durationText.trim();
    }

    return renderDuration(visitor.duration, visitor.durationUnit || "minutes");
  }

  
  function isWarning(endTime) {
    const remainingMinutes = getRemainingMinutes(endTime);
    return remainingMinutes <= 5 && remainingMinutes > 0;
  }

  
  function isExpired(endTime) {
    return endTime <= currentTime;
  }

  
  async function deactivateVisitor(visitor) {
    
    try {
      
      const isPersonalVisitor = visitor.purpose === "Personal / Non-School Related";
      const hasReachedDeadline = Number(visitor.endTime || 0) <= currentTime;
      const fullyConfirmed = isFullyConfirmed(visitor);

      
      const nextStatus = hasReachedDeadline && (!isPersonalVisitor && !fullyConfirmed || isPersonalVisitor)
        ? "expired"
        : "deactivated";

      
      let violationType = "";
      if (isPersonalVisitor && hasReachedDeadline) {
        violationType = "Time Exceeded";
      } else if (!isPersonalVisitor) {
        
        violationType = getViolationType(visitor, currentTime);
      }
     
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
      
      
      if (violationType) {
        updateData.violationType = violationType;
      } else {
        updateData.violationType = "";
      }
      
      await updateDoc(doc(db, "visitors", visitor.id), updateData);

      
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
  
  
  const personalVisitors = activeVisitorsList.filter(function (visitor) {
    return visitor.purpose === "Personal / Non-School Related";
  });
  

  const schoolRelatedVisitors = activeVisitorsList.filter(function (visitor) {
    return visitor.purpose === "School Related";
  });
  
  
  const displayedVisitors = selectedCategory === "Personal / Non-School Related" 
    ? personalVisitors 
    : schoolRelatedVisitors;
  
  
  const activeVisitorsCount = activeVisitorsList.length;
  
  const violationsCount = visitors.filter(function (visitor) {
    return visitor.status === "expired" || (visitor.status === "deactivated" && visitor.violationType);
  }).length;
  
  const todayLabel = new Date(currentTime).toDateString();
  // I-filter ang visitors na nangyari ngayon.
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

              let timeInLabel = "N/A";

              
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

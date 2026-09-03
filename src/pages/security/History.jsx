
import { useState, useEffect } from "react";

import { collection, onSnapshot } from "firebase/firestore";

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
  const confirmations = getDestinationConfirmations(visitor);
  return confirmations.length > 0 && confirmations.every(function (confirmation) {
    return confirmation.status === "Done";
  });
}

function hasPartialConfirmation(visitor) {
  const confirmations = getDestinationConfirmations(visitor);
  const confirmedCount = confirmations.filter(function (confirmation) {
    return confirmation.status === "Done";
  }).length;
  return confirmedCount > 0 && confirmedCount < confirmations.length;
}

function getPurposeLabel(visitor) {
  if (visitor.purpose === "School Related" && visitor.schoolPurpose) {
    return `School Related - ${visitor.schoolPurpose}`;
  }

  return visitor.purpose;
}


function getViolationLabel(visitor) {
  
  if (visitor.purpose === "Personal / Non-School Related") {
    
    if (visitor.violationType === "Exceed Time" || visitor.violationType === "Time Exceeded") {
      return "Time Exceeded";
    }
    
    if (visitor.status === "deactivated") {
      return "Completed";
    }
   
    if (visitor.status === "expired") {
      return visitor.violationType ? "Expired" : "Completed";
    }
    return visitor.status || "Unknown";
  }

  
  if (visitor.violationType === "Uncomplete Confirmation and Time Exceed") {
    return "Uncomplete Confirmation and Time Exceed";
  }

  if (visitor.violationType === "No Confirmation and Time Exceed") {
    return "No Confirmation and Time Exceed";
  }

  
  if (visitor.violationType === "No Confirmation") {
    return "No Confirmation";
  }

  if (visitor.status === "deactivated" && hasPartialConfirmation(visitor)) {
    return "Uncomplete Confirmation";
  }

  
  if (visitor.violationType === "Exceed Time" || visitor.violationType === "Time Exceeded") {
    return "Time Exceeded";
  }

  
  if (visitor.status === "expired") {
    return "Expired";
  }


  if (visitor.status === "deactivated") {
    return "Completed";
  }


  return visitor.status || "Unknown";
}


function getPillClass(visitor) {
  
  if (visitor.status === "deactivated" && !visitor.violationType && isFullyConfirmed(visitor)) {
    return "status-pill--done";
  }

  
  if (visitor.violationType || visitor.status === "expired") {
    return "status-pill--expired";
  }

 
  return "status-pill--done";
}


function filterVisitorsByName(allVisitors, searchText) {
 
  if (!searchText) {
    return allVisitors;
  }


  const exactMatches = [];
  const otherMatches = [];

  
  allVisitors.forEach(function (visitor) {
    const name = (visitor.name || "").toLowerCase();

    if (name.startsWith(searchText)) {
      exactMatches.push(visitor);
    } else if (name.includes(searchText)) {
      otherMatches.push(visitor);
    }
  });

  
  return [...exactMatches, ...otherMatches];
}


export default function History() {
  
  const [visitors, setVisitors] = useState([]);

  
  const [search, setSearch] = useState("");

  
  const [loading, setLoading] = useState(true);


  const [selectedCategory, setSelectedCategory] = useState("Personal / Non-School Related");

  
  useEffect(function () {
    
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      
      const visitorList = snapshot.docs
        .map(function (item) {
          return {
            id: item.id,
            ...item.data()
          };
        })
        .filter(function (visitor) {
          return visitor.status === "deactivated" || visitor.status === "expired";
        })
        .sort(function (first, second) {
          return (second.endTime || second.startTime) - (first.endTime || first.startTime);
        });

      
      setVisitors(visitorList);
      setLoading(false);
    });

    
    return function () {
      unsubscribe();
    };
  }, []);

  
  const searchText = search.trim().toLowerCase();
  
 
  const categoryFilteredVisitors = visitors.filter(function (visitor) {
    if (selectedCategory === "Personal / Non-School Related") {
      return visitor.purpose === "Personal / Non-School Related";
    } else {
      return visitor.purpose === "School Related";
    }
  });
  
  
  const filteredVisitors = filterVisitorsByName(categoryFilteredVisitors, searchText);

  
  function handleClearSearch() {
    setSearch("");
  }

  
  return (
    <div className="page-card">
      <div className="card">
        <div className="section-header">
          <div>
            <p className="section-kicker">History</p>
          </div>
          <span className="status-pill status-pill--done">{filteredVisitors.length} records</span>
        </div>

        <div className="visitor-category-tabs">
          <button
            className={`category-tab ${selectedCategory === "Personal / Non-School Related" ? "category-tab--active" : ""}`}
            onClick={function () {
              setSelectedCategory("Personal / Non-School Related");
            }}
          >
            Personal / Non-School Related {visitors.filter(function (visitor) { return visitor.purpose === "Personal / Non-School Related"; }).length > 0 && `(${visitors.filter(function (visitor) { return visitor.purpose === "Personal / Non-School Related"; }).length})`}
          </button>
          <button
            className={`category-tab ${selectedCategory === "School Related" ? "category-tab--active" : ""}`}
            onClick={function () {
              setSelectedCategory("School Related");
            }}
          >
            School Related {visitors.filter(function (visitor) { return visitor.purpose === "School Related"; }).length > 0 && `(${visitors.filter(function (visitor) { return visitor.purpose === "School Related"; }).length})`}
          </button>
        </div>

        <div className="search-row">
          <input
            value={search}
            onChange={function (event) {
              setSearch(event.target.value);
            }}
            placeholder="Search visitor name"
            className="search-input"
          />
          {search && (
            <button type="button" onClick={handleClearSearch} className="action-button action-button--primary">
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty-state">Loading history...</div>
        ) : filteredVisitors.length === 0 ? (
          <div className="history-grid">
            <div className="visitor-card visitor-card--history">
              <p className="history-title">No matching history</p>
              <p className="history-note">
                {search 
                  ? "Try removing the search filter or use another name." 
                  : selectedCategory === "Personal / Non-School Related"
                  ? "No personal/non-school related visitor records."
                  : "No school-related visitor records."}
              </p>
            </div>
          </div>
        ) : (
          <div className="history-grid history-scroll">
            {filteredVisitors.map(function (visitor) {
              let timeInLabel = "N/A";
              let timeOutLabel = "N/A";

              if (visitor.timeIn) {
                timeInLabel = new Date(visitor.timeIn).toLocaleString();
              }

              if (visitor.timeOut) {
                timeOutLabel = new Date(visitor.timeOut).toLocaleString();
              }

              const displayDuration = typeof visitor.durationText === "string" && visitor.durationText.trim()
                ? visitor.durationText.trim()
                : `${visitor.duration} ${visitor.durationUnit || "minutes"}`;

              return (
                <div key={visitor.id} className="visitor-card visitor-card--history">
                  <div className="visitor-card__top">
                    <div>
                      <p className="visitor-card__title">{visitor.name}</p>
                        <p className="visitor-card__subtitle">{getPurposeLabel(visitor)}</p>
                    </div>
                    <span className={`status-pill ${getPillClass(visitor)}`}>
                      {getViolationLabel(visitor)}
                    </span>
                  </div>

                  <div className="visitor-meta">
                    <span>📍 {visitor.currentLocation || visitor.location || "Entrance"}</span>
                    <span>🎯 Destination: {getDestinations(visitor).join(", ") || "N/A"}</span>
                    {visitor.purpose === "School Related" && getDestinationConfirmations(visitor).map(function (confirmation) {
                      return <span key={confirmation.destination}>✓ {confirmation.destination} Confirm: {confirmation.status === "Done" ? "Confirmed" : "Pending"}</span>;
                    })}
                    <span>🪪 UID/EPC: {visitor.uid || visitor.epc || "N/A"}</span>
                    <span>⏱ Duration: {displayDuration}</span>
                    <span>🕒 Time In: {timeInLabel}</span>
                    <span>⏳ Time Out: {timeOutLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

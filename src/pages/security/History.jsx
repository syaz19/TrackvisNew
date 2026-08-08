/**
 * pages/security/History.jsx
 *
 * Layunin: Ipakita ang history ng completed at expired visitors para sa security view.
 * - Nag-subscribe sa `visitors` collection at ifi-filter ang mga `deactivated` at `expired` records.
 * - Nagbibigay ng search at pinned status pills para madaling ma-scan ang history.
 * - Bahagi ng app: historical records at auditing para sa security team.
 */
import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

function getViolationLabel(visitor) {
  // I-translate ang visitor status sa label na ipinapakita sa history card.
  if (visitor.violationType === "Both") {
    return "Both";
  }

  if (visitor.violationType === "No Confirmation") {
    return "No Confirmation";
  }

  if (visitor.violationType === "Exceed Time") {
    return "Exceed Time";
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
  // Piliin ang kulay base sa status ng visitor.
  if (visitor.status === "deactivated") {
    return "status-pill--done";
  }

  if (visitor.violationType || visitor.status === "expired") {
    return "status-pill--expired";
  }

  return "status-pill--done";
}

function filterVisitorsByName(allVisitors, searchText) {
  // I-filter ang listahan base sa pangalan ng visitor.
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
  // I-store ang records, search text, at loading state.
  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    // Pakinggan ang visitors sa Firestore at kunin lang ang completed/expired records.
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
  const filteredVisitors = filterVisitorsByName(visitors, searchText);

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
              <p className="history-note">Try removing the search filter or use another name.</p>
            </div>
          </div>
        ) : (
          <div className="history-grid history-scroll">
            {filteredVisitors.map(function (visitor) {
              let confirmationLabel = "Not Confirmed";

              if (visitor.confirmStatus === "Done") {
                confirmationLabel = "Confirmed";
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
                <div key={visitor.id} className="visitor-card visitor-card--history">
                  <div className="visitor-card__top">
                    <div>
                      <p className="visitor-card__title">{visitor.name}</p>
                      <p className="visitor-card__subtitle">{visitor.purpose}</p>
                    </div>
                    <span className={`status-pill ${getPillClass(visitor)}`}>
                      {getViolationLabel(visitor)}
                    </span>
                  </div>

                  <div className="visitor-meta">
                    <span>📍 {visitor.location || "Entrance"}</span>
                    <span>🎯 {visitor.destination}</span>
                    <span>✓ Confirmation: {confirmationLabel}</span>
                    <span>🪪 UID/EPC: {visitor.uid || visitor.epc || "N/A"}</span>
                    <span>⏱ Duration: {visitor.duration} {visitor.durationUnit || "minutes"}</span>
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

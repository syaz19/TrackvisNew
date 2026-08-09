/**
 * pages/security/History.jsx
 *
 * Layunin: Ipakita ang history ng completed at expired visitors para sa security view.
 * - Nag-subscribe sa `visitors` collection at ifi-filter ang mga `deactivated` at `expired` records.
 * - Nagbibigay ng search at pinned status pills para madaling ma-scan ang history.
 * - Bahagi ng app: historical records at auditing para sa security team.
 */
// I-import ang hooks para sa state at effect sa component.
import { useState, useEffect } from "react";
// I-import ang Firestore helper para makinig sa visitors collection.
import { collection, onSnapshot } from "firebase/firestore";
// I-import ang Firestore instance para makapag-read ng data.
import { db } from "../../firebase";

// I-translate ang visitor status sa label na ilalabas sa history card.
function getViolationLabel(visitor) {
  // Kung may violation type na Both, ipinapakita ang ganitong label.
  if (visitor.violationType === "Both") {
    return "Both";
  }

  // Kung may violation type na No Confirmation, ipinapakita ang ganitong label.
  if (visitor.violationType === "No Confirmation") {
    return "No Confirmation";
  }

  // Kung may violation type na Exceed Time, ipinapakita ang ganitong label.
  if (visitor.violationType === "Exceed Time") {
    return "Exceed Time";
  }

  // Kung status ay expired, ipinapakita angExpired label.
  if (visitor.status === "expired") {
    return "Expired";
  }

  // Kung status ay deactivated, ipinapakita ang Completed label.
  if (visitor.status === "deactivated") {
    return "Completed";
  }

  // Kung walang match, ibinabalik ang default status o Unknown.
  return visitor.status || "Unknown";
}

// I-pili ang class name para sa pill color base sa status.
function getPillClass(visitor) {
  // Kung completed na ang visitor, gagamitin ang done style.
  if (visitor.status === "deactivated" && !visitor.violationType) {
    return "status-pill--done";
  }

  // Kung may violation o expired, gagamitin ang expired style (red).
  if (visitor.violationType || visitor.status === "expired") {
    return "status-pill--expired";
  }

  // Default para sa completed records.
  return "status-pill--done";
}

// I-filter ang visitors base sa pangalan para sa search box.
function filterVisitorsByName(allVisitors, searchText) {
  // Kung walang search text, ibinabalik ang buong listahan.
  if (!searchText) {
    return allVisitors;
  }

  // Ihiwa-hiwalay ang exact match at ibang match.
  const exactMatches = [];
  const otherMatches = [];

  // I-iterate ang bawat visitor at tinitingnan kung may match sa pangalan.
  allVisitors.forEach(function (visitor) {
    const name = (visitor.name || "").toLowerCase();

    if (name.startsWith(searchText)) {
      exactMatches.push(visitor);
    } else if (name.includes(searchText)) {
      otherMatches.push(visitor);
    }
  });

  // Ibalik ang exact matches muna saka ang iba pang match.
  return [...exactMatches, ...otherMatches];
}

// I-export ang History component para sa history page.
export default function History() {
  // I-store ang records, search text, at loading state.
  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // I-listen sa Firestore at i-filter ang completed at expired visitor records.
  useEffect(function () {
    // Pinapakinggan ang visitors collection sa Firestore.
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      // Ginagawa ang visitor list mula sa snapshot at i-filter ang relevant statuses.
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

      // Ini-update ang state para maipakita ang history records.
      setVisitors(visitorList);
      setLoading(false);
    });

    // I-clean up ang listener kapag aalis ang component.
    return function () {
      unsubscribe();
    };
  }, []);

  // I-trim ang input at gawing lowercase para sa consistent search.
  const searchText = search.trim().toLowerCase();
  // I-filter ang visitors base sa search input.
  const filteredVisitors = filterVisitorsByName(visitors, searchText);

  // I-clear ang search field kapag pinindot ang button.
  function handleClearSearch() {
    setSearch("");
  }

  // I-render ang history page layout.
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
                    <span>📍 {visitor.currentLocation || visitor.location || "Entrance"}</span>
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

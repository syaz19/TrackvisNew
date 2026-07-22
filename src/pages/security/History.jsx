import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

function getViolationLabel(visitor) {
  // Binabasa ang status ng visitor para makita ang label sa history card.
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
  // Pinipili ang kulay base sa status.
  if (visitor.status === "deactivated") {
    return "status-pill--done";
  }

  if (visitor.violationType || visitor.status === "expired") {
    return "status-pill--expired";
  }

  return "status-pill--done";
}

export default function History() {
  // Ini-store ang history records, search text, at loading state.
  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tinutunghayan ang visitors collection at pinipili ang completed/expired records.
    const unsubscribe = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const list = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data()
        }))
        .filter((visitor) => visitor.status === "deactivated" || visitor.status === "expired")
        .sort((first, second) => (second.endTime || second.startTime) - (first.endTime || first.startTime));

      setVisitors(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const searchText = search.trim().toLowerCase();
  let filteredVisitors = visitors;

  if (searchText) {
    // Pinapadali ang paghahanap sa visitor name.
    const exactMatches = [];
    const otherMatches = [];

    visitors.forEach((visitor) => {
      const name = (visitor.name || "").toLowerCase();

      if (name.startsWith(searchText)) {
        exactMatches.push(visitor);
      } else if (name.includes(searchText)) {
        otherMatches.push(visitor);
      }
    });

    filteredVisitors = [...exactMatches, ...otherMatches];
  }

  return (
    <div className="page-card">
      <div className="card">
        <div className="section-header">
          <div>
            <p className="section-kicker">History</p>
            <h1>Visitor History</h1>
          </div>
          <span className="status-pill status-pill--done">{filteredVisitors.length} records</span>
        </div>
        <p className="section-note">Completed and expired visitor records.</p>

        <div className="search-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search visitor name"
            className="search-input"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="action-button action-button--primary">
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
          <div className="history-grid">
            {filteredVisitors.map((visitor) => (
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
                  <span>✓ Confirmation: {visitor.confirmStatus === "Done" ? "Confirmed" : "Not Confirmed"}</span>
                  <span>🪪 UID/EPC: {visitor.uid || "N/A"}</span>
                  <span>⏱ Duration: {visitor.duration} {visitor.durationUnit || "minutes"}</span>
                  <span>🕒 Time In: {visitor.timeIn ? new Date(visitor.timeIn).toLocaleString() : "N/A"}</span>
                  <span>⏳ Time Out: {visitor.timeOut ? new Date(visitor.timeOut).toLocaleString() : "N/A"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

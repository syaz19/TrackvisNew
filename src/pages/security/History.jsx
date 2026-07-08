import { useMemo, useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

const getViolationLabel = (visitor) => {
  const violationType = visitor.violationType;
  if (violationType === "Both") return "Both";
  if (violationType === "No Confirmation") return "No Confirmation";
  if (violationType === "Exceed Time") return "Exceed Time";
  if (visitor.status === "expired") return "Expired";
  if (visitor.status === "deactivated") return "Completed";
  return visitor.status || "Unknown";
};

const getPillClass = (visitor) => {
  if (visitor.status === "deactivated") return "status-pill--done";
  if (visitor.violationType || visitor.status === "expired") return "status-pill--expired";
  return "status-pill--done";
};

export default function History() {
  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((v) => v.status === "deactivated" || v.status === "expired")
        .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime));
      setVisitors(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredVisitors = useMemo(() => {
    if (!normalizedSearch) {
      return visitors;
    }

    const startsWith = [];
    const contains = [];

    visitors.forEach((visitor) => {
      const name = (visitor.name || "").toLowerCase();
      if (name.startsWith(normalizedSearch)) {
        startsWith.push(visitor);
      } else if (name.includes(normalizedSearch)) {
        contains.push(visitor);
      }
    });

    const sortAlpha = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

    return [...startsWith.sort(sortAlpha), ...contains.sort(sortAlpha)];
  }, [visitors, normalizedSearch]);

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
            onChange={(e) => setSearch(e.target.value)}
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
            {filteredVisitors.map((v) => (
              <div key={v.id} className="visitor-card visitor-card--history">
                <div className="visitor-card__top">
                  <div>
                    <p className="visitor-card__title">{v.name}</p>
                    <p className="visitor-card__subtitle">{v.purpose}</p>
                  </div>
                  <span className={`status-pill ${getPillClass(v)}`}>
                    {getViolationLabel(v)}
                  </span>
                </div>

                <div className="visitor-meta">
                  <span>📍 {v.location || "Entrance"}</span>
                  <span>🎯 {v.destination}</span>
                  <span>✓ Confirmation: {v.confirmStatus === "Done" ? "Confirmed" : "Not Confirmed"}</span>
                  <span>🪪 UID/EPC: {v.uid || "N/A"}</span>
                  <span>⏱ Duration: {v.duration} {v.durationUnit || "minutes"}</span>
                  <span>🕒 Time In: {v.timeIn ? new Date(v.timeIn).toLocaleString() : "N/A"}</span>
                  <span>⏳ Time Out: {v.timeOut ? new Date(v.timeOut).toLocaleString() : "N/A"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

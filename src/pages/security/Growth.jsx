import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

export default function Growth() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setVisitors(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Calculate today's visitors
  const today = new Date().toDateString();
  const todayCount = visitors.filter(
    (v) => new Date(v.startTime).toDateString() === today
  ).length;

  // Calculate this week's visitors (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekCount = visitors.filter((v) => new Date(v.startTime) > weekAgo).length;

  // Calculate total visitors
  const totalCount = visitors.length;

  return (
    <div className="page-card">
      <div className="card">
        <h1>Growth Analytics</h1>
        <p className="section-note">Visitor trends and daily statistics.</p>
        {loading ? (
          <p>Loading analytics...</p>
        ) : (
          <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "16px", borderRadius: "12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 8px", color: "#9ca3af", fontSize: "0.9rem" }}>Today</p>
              <p style={{ margin: "0", fontSize: "2rem", fontWeight: "700", color: "#10b981" }}>{todayCount}</p>
            </div>
            <div style={{ background: "rgba(59, 130, 246, 0.1)", padding: "16px", borderRadius: "12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 8px", color: "#9ca3af", fontSize: "0.9rem" }}>This Week</p>
              <p style={{ margin: "0", fontSize: "2rem", fontWeight: "700", color: "#3b82f6" }}>{weekCount}</p>
            </div>
            <div style={{ background: "rgba(168, 85, 247, 0.1)", padding: "16px", borderRadius: "12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 8px", color: "#9ca3af", fontSize: "0.9rem" }}>Total</p>
              <p style={{ margin: "0", fontSize: "2rem", fontWeight: "700", color: "#a855f7" }}>{totalCount}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

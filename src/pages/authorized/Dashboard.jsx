import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, updateDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { auth } from "../../firebase";

export default function Dashboard() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    const fetchUserData = async () => {
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
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    if (!userData || !userData.subRole) {
      return;
    }

    const unsub = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((visitor) => visitor.destination === userData.subRole);

      setVisitors(data);
      setLoading(false);
    });

    return () => unsub();
  }, [userData]);

  const isHistoricalVisitor = (visitor) => {
    const status = (visitor.status || "").toLowerCase();
    if (["deactivated", "expired", "completed", "done", "inactive", "cancelled"].includes(status)) {
      return true;
    }

    return Boolean(visitor.endTime || visitor.timeOut);
  };

  const handleConfirmVisitor = async (visitorId) => {
    try {
        await updateDoc(doc(db, "visitors", visitorId), {
        confirmStatus: "Done",
        confirmedAt: serverTimestamp(),
        confirmedBy: auth.currentUser?.email || null
      });
      // optimistically update local list so UI moves item out of pending immediately
      setVisitors((prev) => prev.map((v) => (v.id === visitorId ? { ...v, confirmStatus: "Done", confirmedAt: Date.now(), confirmedBy: auth.currentUser?.email || null } : v)));
    } catch (error) {
      alert("Error confirming visitor: " + error.message);
    }
  };

  const pendingVisitors = useMemo(
    () => visitors.filter((visitor) => visitor.status === "active" && (visitor.confirmStatus || "") !== "Done"),
    [visitors]
  );

  const confirmedHistory = useMemo(
    () =>
      visitors
        .filter((visitor) => visitor.confirmStatus === "Done" || isHistoricalVisitor(visitor))
        .sort((a, b) => (b.confirmedAt || b.endTime || b.startTime || 0) - (a.confirmedAt || a.endTime || a.startTime || 0)),
    [visitors]
  );

  if (loading) {
    return (
      <div className="page-card">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

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
              {pendingVisitors.map((visitor) => (
                <article key={visitor.id} className="visitor-card visitor-card--active">
                  <div className="visitor-card__top">
                    <div>
                      <h4 className="visitor-card__title">{visitor.name}</h4>
                      <p className="visitor-card__subtitle">{visitor.purpose}</p>
                    </div>
                    <span className="status-pill status-pill--active">Pending</span>
                  </div>

                  <div className="visitor-meta">
                    <span>📍 {visitor.location || "Entrance"}</span>
                    <span>🎯 {visitor.destination}</span>
                    <span>✓ Confirm Status: {visitor.confirmStatus === "Done" ? "Done" : "Awaiting confirmation"}</span>
                    <span>🕒 Time In: {visitor.timeIn ? new Date(visitor.timeIn).toLocaleTimeString() : "N/A"}</span>
                  </div>

                  {visitor.confirmStatus !== "Done" && (
                    <div className="visitor-actions">
                      <button className="action-button action-button--primary" onClick={() => handleConfirmVisitor(visitor.id)}>
                        Confirm Arrival
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card summary-card dashboard-section">
          <div className="section-header">
            <div>
              <p className="section-kicker">History</p>
              <h3>Your Confirmed Visitors</h3>
            </div>
            <span className="status-pill status-pill--done">{confirmedHistory.length} records</span>
          </div>

          {confirmedHistory.length === 0 ? (
            <div className="empty-state">No confirmed visitor history yet.</div>
          ) : (
            <div className="history-grid">
              {confirmedHistory.map((visitor) => (
                <article key={visitor.id} className="visitor-card visitor-card--history">
                  <div className="visitor-card__top">
                    <div>
                      <h4 className="visitor-card__title">{visitor.name}</h4>
                      <p className="visitor-card__subtitle">{visitor.purpose}</p>
                    </div>
                    <span className={`status-pill ${visitor.status === "deactivated" ? "status-pill--done" : "status-pill--expired"}`}>
                      {visitor.status === "deactivated" ? "Completed" : visitor.confirmStatus === "Done" ? "Confirmed" : "Processed"}
                    </span>
                  </div>

                  <div className="visitor-meta">
                    <span>📍 {visitor.location || "Entrance"}</span>
                    <span>🎯 {visitor.destination}</span>
                    <span>🕒 Time In: {visitor.timeIn ? new Date(visitor.timeIn).toLocaleString() : "N/A"}</span>
                    <span>⏱ Time Out: {visitor.timeOut ? new Date(visitor.timeOut).toLocaleString() : "N/A"}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

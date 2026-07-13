import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

  const getDate = (timestamp) => {
    const date = new Date(timestamp || Date.now());
    return date.toLocaleDateString();
  };

  const chartData = useMemo(() => {
    const counts = {};
    visitors.forEach((v) => {
      const date = getDate(v.startTime || v.timeIn);
      counts[date] = (counts[date] || 0) + 1;
    });

    const sortedDates = Object.keys(counts).sort((a, b) => new Date(a) - new Date(b));
    return {
      labels: sortedDates,
      datasets: [
        {
          label: "Visitors per Day",
          data: sortedDates.map((date) => counts[date]),
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.25)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#38bdf8"
        }
      ]
    };
  }, [visitors]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: "Visitors per Day",
          color: "#cbd5e1",
          font: {
            size: 16,
            weight: "600"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#cbd5e1"
          },
          grid: {
            color: "rgba(148, 163, 184, 0.1)"
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#cbd5e1"
          },
          grid: {
            color: "rgba(148, 163, 184, 0.1)"
          }
        }
      }
    }),
    []
  );

  return (
    <div className="page-card">
      <div className="card">
        <h1>Growth Analytics</h1>
        <p className="section-note">Visitor trends and daily statistics.</p>
        {loading ? (
          <p>Loading analytics...</p>
        ) : (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
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
            <div style={{ background: "rgba(15, 23, 42, 0.9)", padding: "18px", borderRadius: "16px", minHeight: "360px" }}>
              <div style={{ marginBottom: "14px" }}>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.95rem", fontWeight: 600 }}>Growth Dashboard</p>
              </div>
              <div style={{ height: "300px" }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

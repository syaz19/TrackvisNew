import { useState, useEffect } from "react";
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
  const [loading, setLoading] = useState(true);
  
  const [summary, setSummary] = useState({ todayCount: 0, weekCount: 0, totalCount: 0 });
  const [chartDataState, setChartDataState] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      setLoading(false);

      // compute derived summary and chart data here to avoid Date.now() in render
      const current = Date.now();
      const today = new Date(current).toDateString();
      const weekAgo = new Date(current - 7 * 24 * 60 * 60 * 1000);

      const todayCount = list.filter((visitor) => new Date(visitor.startTime).toDateString() === today).length;
      const weekCount = list.filter((visitor) => new Date(visitor.startTime) > weekAgo).length;
      const totalCount = list.length;

      setSummary({ todayCount, weekCount, totalCount });

      const counts = {};
      list.forEach((visitor) => {
        const ts = visitor.startTime || visitor.timeIn || current;
        const date = new Date(ts).toLocaleDateString();
        counts[date] = (counts[date] || 0) + 1;
      });

      const sortedDates = Object.keys(counts).sort((a, b) => new Date(a) - new Date(b));
      const chart = {
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

      setChartDataState(chart);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // removed standalone Date.now() effect; now is set when visitors change below
  }, []);

  const summaryCards = [
    {
      label: "Today",
      className: "summary-card-item summary-card-item--success",
      valueColor: "#10b981"
    },
    {
      label: "This Week",
      className: "summary-card-item summary-card-item--info",
      valueColor: "#3b82f6"
    },
    {
      label: "Total",
      className: "summary-card-item summary-card-item--purple",
      valueColor: "#a855f7"
    }
  ];
 

  const chartData = chartDataState;

  const chartOptions = {
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
  };
  

  return (
    <div className="page-card">
      <div className="card">
        <div className="page-heading">
          <h1>Growth Analytics</h1>
          <p className="section-note">Visitor trends and daily statistics.</p>
        </div>

        {loading ? (
          <p>Loading analytics...</p>
        ) : (
          <div className="page-card">
            <div className="summary-grid">
              {summaryCards.map((card) => (
                <div key={card.label} className={card.className}>
                  <p className="summary-card-label">{card.label}</p>
                  <p className="summary-card-value" style={{ color: card.valueColor }}>
                    {card.label === "Today" ? summary.todayCount : card.label === "This Week" ? summary.weekCount : summary.totalCount}
                  </p>
                </div>
              ))}
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <p className="chart-card-title">Growth Dashboard</p>
              </div>
              <div className="chart-shell">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

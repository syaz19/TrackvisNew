// I-import ang React hooks para sa state at effect.
import { useState, useEffect } from "react";
// I-import ang Firestore helper para makinig sa visitors collection.
import { collection, onSnapshot } from "firebase/firestore";
// I-import ang Firestore instance na konektado sa app.
import { db } from "../../firebase";
// I-import ang Chart.js modules para gumawa ng line chart.
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
// I-import ang React wrapper para ipakita ang chart sa UI.
import { Line } from "react-chartjs-2";

// I-register ang chart components para gumana ang line graph.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// I-build ang summary statistics para sa analytics cards.
function buildSummary(visitors, now) {
  // Kinukuha ang label ng araw ngayon para sa daily count.
  const todayLabel = new Date(now).toDateString();
  // Kinukuha ang date na 7 araw ang nakaraan para sa weekly count.
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // I-filter ang visitors na nangyari ngayon.
  const todayVisitors = visitors.filter(function (visitor) {
    return new Date(visitor.startTime).toDateString() === todayLabel;
  });
  // I-filter ang visitors sa nakalipas na 7 araw.
  const weekVisitors = visitors.filter(function (visitor) {
    return new Date(visitor.startTime) > weekAgo;
  });

  // Ibalik ang computed counts para sa UI.
  return {
    todayCount: todayVisitors.length,
    weekCount: weekVisitors.length,
    totalCount: visitors.length
  };
}

// I-build ang data structure na kailangan ng chart.
function buildChartData(visitors, now) {
  // I-group ang visitors ayon sa petsa para sa chart.
  const countsByDate = {};

  // I-iterate ang bawat visitor para bilangin ang visits ayon sa date.
  visitors.forEach(function (visitor) {
    const timeValue = visitor.startTime || visitor.timeIn || now;
    const dateLabel = new Date(timeValue).toLocaleDateString();
    countsByDate[dateLabel] = (countsByDate[dateLabel] || 0) + 1;
  });

  // I-sort ang dates para tama ang sequence sa chart.
  const sortedDates = Object.keys(countsByDate).sort(function (first, second) {
    return new Date(first) - new Date(second);
  });

  // Ibalik ang labels at values para sa line chart.
  return {
    labels: sortedDates,
    datasets: [
      {
        label: "Visitors per Day",
        data: sortedDates.map(function (dateLabel) {
          return countsByDate[dateLabel];
        }),
        borderColor: "#4F46E5",
        backgroundColor: "rgba(79, 70, 229, 0.25)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#6366F1"
      }
    ]
  };
}

// I-export ang Growth component para sa analytics page.
export default function Growth() {
  // I-store ang loading state, summary, at chart data.
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ todayCount: 0, weekCount: 0, totalCount: 0 });
  const [chartDataState, setChartDataState] = useState({ labels: [], datasets: [] });

  // I-listen sa Firestore para i-update ang analytics kapag may pagbabago.
  useEffect(function () {
    // Pinapakinggan ang visitors collection sa Firestore.
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      // Ginagawa ang array ng visitor objects mula sa snapshot.
      const visitorList = snapshot.docs.map(function (item) {
        return {
          id: item.id,
          ...item.data()
        };
      });

      // Tinatanggal ang loading state kapag handa na ang data.
      setLoading(false);

      // Kinukuha ang current time para sa summary at chart.
      const now = Date.now();
      const nextSummary = buildSummary(visitorList, now);
      const newChart = buildChartData(visitorList, now);

      // Ini-update ang summary at chart state.
      setSummary(nextSummary);
      setChartDataState(newChart);
    });

    // I-clean up ang listener kapag hindi na ginagamit ang component.
    return function () {
      unsubscribe();
    };
  }, []);

  // I-define ang layout para sa summary cards.
  const summaryCards = [
    {
      label: "Today",
      className: "summary-card-item summary-card-item--success",
      valueColor: "#10b981"
    },
    {
      label: "This Week",
      className: "summary-card-item summary-card-item--info",
      valueColor: "#818CF8"
    },
    {
      label: "Total",
      className: "summary-card-item summary-card-item--purple",
      valueColor: "#6366F1"
    }
  ];

  // I-set ang visual options para sa line chart.
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
        min: 0,
        max: 5,
        ticks: {
          color: "#cbd5e1",
          stepSize: 1
        },
        grid: {
          color: "rgba(148, 163, 184, 0.1)"
        }
      }
    }
  };

  // I-render ang analytics page kapag handa na ang data.
  return (
    <div className="page-card growth-page-card">
      <div className="card growth-card large-panel">
        <div className="page-heading">
          <h1>Growth Analytics</h1>
          <p className="section-note">Visitor trends and daily statistics.</p>
        </div>

        {loading ? (
          <p>Loading analytics...</p>
        ) : (
          <div className="page-card">
            <div className="summary-grid">
              {summaryCards.map(function (card) {
                let summaryValue = summary.totalCount;

                if (card.label === "Today") {
                  summaryValue = summary.todayCount;
                } else if (card.label === "This Week") {
                  summaryValue = summary.weekCount;
                }

                return (
                  <div key={card.label} className={card.className}>
                    <p className="summary-card-label">{card.label}</p>
                    <p className="summary-card-value" style={{ color: card.valueColor }}>
                      {summaryValue}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <p className="chart-card-title">Growth Dashboard</p>
              </div>
              <div className="chart-shell">
                <Line data={chartDataState} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

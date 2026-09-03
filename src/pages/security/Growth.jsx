
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


function buildSummary(visitors, now) {
  
  const todayLabel = new Date(now).toDateString();
  
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  
  const todayVisitors = visitors.filter(function (visitor) {
    return new Date(visitor.startTime).toDateString() === todayLabel;
  });
  
  const weekVisitors = visitors.filter(function (visitor) {
    return new Date(visitor.startTime) > weekAgo;
  });

  
  return {
    todayCount: todayVisitors.length,
    weekCount: weekVisitors.length,
    totalCount: visitors.length
  };
}


function buildChartData(visitors, now) {
  
  const countsByDate = {};

  
  visitors.forEach(function (visitor) {
    const timeValue = visitor.startTime || visitor.timeIn || now;
    const dateLabel = new Date(timeValue).toLocaleDateString();
    countsByDate[dateLabel] = (countsByDate[dateLabel] || 0) + 1;
  });

  
  const sortedDates = Object.keys(countsByDate).sort(function (first, second) {
    return new Date(first) - new Date(second);
  });

  const dailyCounts = [];

  for (let i = 0; i < sortedDates.length; i++) {
    dailyCounts.push(countsByDate[sortedDates[i]]);
  }

  
  return {
    labels: sortedDates,
    datasets: [
      {
        label: "Visitors per Day",
        data: dailyCounts,
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


export default function Growth() {
  
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ todayCount: 0, weekCount: 0, totalCount: 0 });
  const [chartDataState, setChartDataState] = useState({ labels: [], datasets: [] });

  
  useEffect(function () {
    
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      
      const visitorList = snapshot.docs.map(function (item) {
        return {
          id: item.id,
          ...item.data()
        };
      });

      
      setLoading(false);

      
      const now = Date.now();
      const nextSummary = buildSummary(visitorList, now);
      const newChart = buildChartData(visitorList, now);

      
      setSummary(nextSummary);
      setChartDataState(newChart);
    });

    
    return function () {
      unsubscribe();
    };
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
      valueColor: "#818CF8"
    },
    {
      label: "Total",
      className: "summary-card-item summary-card-item--purple",
      valueColor: "#6366F1"
    }
  ];

  
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
        beginAtZero: false,
        min: 1,
        max: 60,
        ticks: {
          color: "#cbd5e1",
          stepSize: 3,
          callback: function (value) {
            return Number(value);
          }
        },
        grid: {
          color: "rgba(148, 163, 184, 0.1)"
        }
      }
    }
  };

  
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

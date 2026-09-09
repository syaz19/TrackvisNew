import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate, formatTime, getDestinations, getMillis, useSecurityLogs } from "./logsData";

function getSearchText(log) {
  const visitor = log.visitor || {};
  return [visitor.name, log.epc, visitor.purpose, visitor.schoolPurpose, getDestinations(visitor).join(" "), visitor.currentLocation, visitor.location, ...log.scans.map(function (scan) { return `${formatDate(scan.timestamp)} ${formatTime(scan.timestamp)} ${scan.location || ""}`; })].join(" ").toLowerCase();
}

export default function Logs() {
  const navigate = useNavigate();
  const { logs, loading } = useSecurityLogs();
  const [search, setSearch] = useState("");
  const [scanDate, setScanDate] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredLogs = logs.filter(function (log) {
    const matchesSearch = !normalizedSearch || getSearchText(log).includes(normalizedSearch);
    const matchesDate = !scanDate || log.scans.some(function (scan) {
      const timestamp = getMillis(scan.timestamp);
      return timestamp > 0 && new Date(timestamp).toISOString().slice(0, 10) === scanDate;
    });
    return matchesSearch && matchesDate;
  });

  return (
    <div className="logs-page">
      <div className="logs-header">
        <div>
          <p className="section-kicker">Security Logs</p>
          <h1>Logs</h1>
          <p className="logs-description">Review every RFID scan recorded by the readers.</p>
        </div>
        <span className="status-pill status-pill--done">{filteredLogs.length} visitors</span>
      </div>
      <div className="logs-search-row">
        <input className="search-input logs-search-input" value={search} onChange={function (event) { setSearch(event.target.value); }} placeholder="Search name, RFID, destination, location, or date" aria-label="Search security logs" />
        {search && <button type="button" className="action-button action-button--primary" onClick={function () { setSearch(""); }}>Clear</button>}
        <input type="date" className="search-input logs-date-input" value={scanDate} onChange={function (event) { setScanDate(event.target.value); }} aria-label="Search logs by date" />
        {scanDate && <button type="button" className="action-button action-button--primary" onClick={function () { setScanDate(""); }}>Clear date</button>}
      </div>
      {loading ? <div className="empty-state">Loading logs...</div> : filteredLogs.length === 0 ? <div className="logs-empty">No matching RFID logs.</div> : (
        <div className="logs-list">
          {filteredLogs.map(function (log) {
            const visitor = log.visitor || {};
            const latestScan = log.scans[0];
            const destination = getDestinations(visitor).join(", ") || "No destination";
            const lastScanLocation = latestScan?.location || log.lastLocation || "N/A";
            const currentLocation = visitor.currentLocation || visitor.location || "N/A";
            return (
              <button type="button" className="log-row" key={`${log.epc}-${log.visitor.id}`} onClick={function () { navigate(`/security/logs/${encodeURIComponent(log.epc)}/${encodeURIComponent(log.visitor.id)}`); }}>
                <span className="log-row-main"><strong>{visitor.name || "Unassigned visitor"}</strong><span>{log.epc}</span></span>
                <span className="log-row-info"><span><b>Purpose:</b> {visitor.purpose || "Unavailable"}</span><span><b>Destination:</b> {destination}</span><span><b>Last Scan:</b> {lastScanLocation}</span><span><b>Current Location:</b> {currentLocation}</span></span>
                <span className="log-row-time"><strong>{log.scans.length} scans</strong><span>{latestScan ? `${formatDate(latestScan.timestamp)} ${formatTime(latestScan.timestamp)}` : "No scan time"}</span></span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

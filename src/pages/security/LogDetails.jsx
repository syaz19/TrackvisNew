import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatTime, getDestinations, useSecurityLogs } from "./logsData";

export default function LogDetails() {
  const navigate = useNavigate();
  const { epc, visitorId } = useParams();
  const { logs, loading } = useSecurityLogs();
  const log = logs.find(function (item) {
    return item.epc === epc && (!visitorId || item.visitor.id === visitorId);
  });
  const visitor = log?.visitor || {};
  const latestScan = log?.scans[0];

  return (
    <div className="logs-page log-details-page">
      <button type="button" className="logs-back-button" onClick={function () { navigate("/security/logs"); }}><ArrowLeft size={17} /> Back to Logs</button>
      {loading ? <div className="empty-state">Loading log details...</div> : !log ? <div className="logs-empty">This RFID log could not be found.</div> : (
        <>
          <div className="logs-header"><div><p className="section-kicker">RFID Log Details</p><h1>{visitor.name || "Unassigned visitor"}</h1><p className="logs-description">Complete scan history for this RFID tag.</p></div></div>
          <section className="log-details-grid">
            <div className="log-info-panel"><h2>Visitor Information</h2><dl>
              <div><dt>Full Name</dt><dd>{visitor.name || "N/A"}</dd></div>
              <div><dt>RFID / EPC</dt><dd>{log.epc}</dd></div>
              <div><dt>Purpose</dt><dd>{visitor.schoolPurpose ? `${visitor.purpose || "N/A"} - ${visitor.schoolPurpose}` : visitor.purpose || "N/A"}</dd></div>
              <div><dt>Destination</dt><dd>{getDestinations(visitor).join(", ") || "N/A"}</dd></div>
              <div><dt>Last Scan</dt><dd>{latestScan?.location || log.lastLocation || "N/A"}</dd></div>
              <div><dt>Current Location</dt><dd>{visitor.currentLocation || visitor.location || "N/A"}</dd></div>
            </dl></div>
            <div className="log-history-panel"><div className="log-history-heading"><h2>RFID Scan History</h2><span>{log.scans.length} scans</span></div>
              {log.scans.length === 0 ? <p className="logs-empty">No scan history recorded.</p> : <div className="scan-history-list">{log.scans.map(function (scan) { return <div className="scan-history-item" key={scan.id}><div><strong>{formatDate(scan.timestamp)}</strong><span>{formatTime(scan.timestamp)}</span></div><b>{scan.location || "Location unavailable"}</b></div>; })}</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * pages/security/Dashboard.jsx
 *
 * Layunin: Dashboard para sa `security` role.
 * - Naka-list ang mga active visitors, may countdown para sa bawat visitor end time, at nagmamarka ng `expired` kapag lumampas ang oras.
 * - Nagre-release ng RFID tag kapag nag-expire ang visitor (update sa `rfid_tags`).
 * - Bahagi ng app: security operations at realtime monitoring ng `visitors` collection.
 *
 * Paano gumagana:
 * 1. Nag-subscribe sa Firestore `visitors` collection at ina-update ang lokal na list.
 * 2. May timer na nagche-check kada segundo para markahan ang expired visitors at i-update ang Firestore.
 * 3. Nagbibigay ng UI para i-manage at suriin ang visitor list.
 */
// I-import ang hooks na kailangan para magamit ang state at effect sa component.
import { useState, useEffect } from "react";
// I-import ang Firestore helpers para makapag-read at makapag-update ng data sa database.
import { collection, deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
// I-import ang Firestore instance na naka-connect sa app.
import { db } from "../../firebase";

// I-declare ang default export na siyang component na ipinapakita sa page.
export default function Dashboard() {
  // I-store ang listahan ng visitors, ang loading state, at ang kasalukuyang oras.
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  // I-set up ang listener para sa live updates sa visitors collection.
  useEffect(function () {
    // Pinapakinggan ang pagbabago sa Firestore upang laging updated ang listahan.
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      // Ginagawa ang array ng visitor objects mula sa snapshot.
      const visitorList = snapshot.docs.map(function (item) {
        return {
          id: item.id,
          ...item.data()
        };
      });

      // Ini-update ang state para maipakita ang bagong data sa UI.
      setVisitors(visitorList);
      setLoading(false);
    });

    // Ibinabalik ang cleanup function para ihinto ang listener kapag hindi na ginagamit ang component.
    return function () {
      unsubscribe();
    };
  }, []);

  // I-define ang function na nag-uuri kung may violation ba ang visitor.
  function getViolationType(visitor, timeValue) {
    // Tinitingnan kung naka-confirm na ang visitor para malaman ang tamang violation label.
    const isConfirmed = visitor.confirmStatus === "Done";
    // I-convert ang endTime sa number para maihambing sa current time.
    const visitorEndTime = Number(visitor.endTime || 0);
    // Sinusuri kung naabot na ang deadline base sa end time at current time.
    const hasReachedDeadline = visitorEndTime > 0 && visitorEndTime <= Number(timeValue || 0);

    // Kung walang confirmation at tapos na ang oras, may parehong violation.
    if (!isConfirmed && hasReachedDeadline) {
      return "Both";
    }

    // Kung wala pang confirmation, ipinapakita ang ganitong violation type.
    if (!isConfirmed) {
      return "No Confirmation";
    }

    // Kung naabot na ang deadline, ipinapakita ang overstay violation.
    if (hasReachedDeadline) {
      return "Exceed Time";
    }

    // Kung walang violation, ibinabalik ang empty string.
    return "";
  }

  // Removed: automatic visitor expiration. Security staff must manually deactivate visitors.
  // Visitors now remain active and visible in the 3D model even after time exceeds,
  // allowing security to monitor them until manually deactivating.

  // Deadline checker removed - no automatic expiration. Security staff controls visitor status.

  // I-update ang current time para sa countdown at expiration logic.
  useEffect(function () {
    // I-set ang initial time sa unang render.
    const timer = setTimeout(function () {
      setCurrentTime(Date.now());
    }, 0);

    // I-update ang oras sa bawat segundo para laging updated ang countdown.
    const clock = setInterval(function () {
      setCurrentTime(Date.now());
    }, 1000);

    // I-clear ang timeout at interval kapag hindi na kailangan.
    return function () {
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, []);

  // I-convert ang natitirang oras sa text na madaling makita sa UI.
  function getRemainingTime(endTime) {
    // Kinukwenta ang difference sa pagitan ng end time at current time.
    const difference = endTime - currentTime;

    // Kung naubos na ang oras, ipinapakita ang zero time.
    if (difference <= 0) {
      return "0m 0s";
    }

    // Kinukuha ang minuto at segundo na natitira.
    const minutes = Math.floor(difference / 1000 / 60);
    const seconds = Math.floor((difference / 1000) % 60);
    return `${minutes}m ${seconds}s`;
  }

  // I-kalkula ang natitirang minuto para sa warning logic.
  function getRemainingMinutes(endTime) {
    return (endTime - currentTime) / 60000;
  }

  // I-format ang duration sa user-friendly label gaya ng min o sec.
  function renderDuration(value, unit) {
    let unitLabel = "hr";

    if (unit === "seconds") {
      unitLabel = "sec";
    } else if (unit === "minutes") {
      unitLabel = "min";
    }

    let suffix = "s";

    if (value === 1) {
      suffix = "";
    }

    return `${value} ${unitLabel}${suffix}`;
  }

  // I-tiningnan kung malapit na ang visitor sa deadline para mag-show ng warning.
  function isWarning(endTime) {
    const remainingMinutes = getRemainingMinutes(endTime);
    return remainingMinutes <= 5 && remainingMinutes > 0;
  }

  // I-tiningnan kung expired na ang visitor base sa current time.
  function isExpired(endTime) {
    return endTime <= currentTime;
  }

  // I-deactivate ang visitor kapag pinindot ang button.
  async function deactivateVisitor(visitor) {
    // Step 1: tinitingnan kung confirmed na ang visitor.
    // Step 2: ina-update ang status sa Firestore.
    // Step 3: ini-release ang RFID tag para maging available ulit.
    try {
      // Tinitingnan kung ang visitor ay may confirmation bilang done.
      const isConfirmed = visitor.confirmStatus === "Done";
      // Kinukuha ang violation type bago i-update ang record.
      const violationType = getViolationType(visitor, currentTime);
      // Pinapili ang susunod na status depende sa confirmation.
      const nextStatus = isConfirmed ? "deactivated" : "expired";

      // Ina-update ang visitor status sa database.
      // Note: Always save violationType if it exists, even for confirmed visitors
      await updateDoc(doc(db, "visitors", visitor.id), {
        status: nextStatus,
        endTime: visitor.endTime || currentTime,
        timeOut: currentTime,
        violationType: violationType
      });

      // Kung may UID, ini-release ang RFID tag.
      if (visitor.uid) {
        try {
          // Ina-update ang RFID tag record para maging available ulit.
          await updateDoc(doc(db, "rfid_tags", visitor.uid), {
            Status: "Available",
            UsedBy: "",
            assignedAt: null,
            currentLocation: deleteField(),
            lastScan: deleteField(),
            updatedAt: deleteField()
          });
        } catch (error) {
          console.warn("Failed to release RFID tag on deactivate:", error);
        }
      }
    } catch (error) {
      alert(error.message);
    }
  }

  // I-wrap ang function para madali itong tawagin sa button click.
  function handleDeactivateButtonClick(visitor) {
    deactivateVisitor(visitor);
  }

  // I-filter ang listahan para sa mga active visitor lang.
  const activeVisitorsList = visitors.filter(function (visitor) {
    return visitor.status === "active";
  });
  // Kinukuha ang total ng active visitors.
  const activeVisitorsCount = activeVisitorsList.length;
  // Kinukuha ang bilang ng visitors with violations (expired or deactivated with violations).
  const violationsCount = visitors.filter(function (visitor) {
    return visitor.status === "expired" || (visitor.status === "deactivated" && visitor.violationType);
  }).length;
  // Ginagawa ang label ng araw para i-compare ang visitors ngayon.
  const todayLabel = new Date(currentTime).toDateString();
  // I-filter ang visitors na nangyari ngayon.
  const todayVisitorsCount = visitors.filter(function (visitor) {
    return new Date(visitor.startTime).toDateString() === todayLabel;
  }).length;

  // Kung naglo-load pa ang data, ipinapakita ang loading state.
  if (loading) {
    return (
      <div className="page-card">
        <div className="card">
          <p className="empty-state">Loading live visitor data...</p>
        </div>
      </div>
    );
  }

  // I-render ang main dashboard layout kapag handa na ang data.
  return (
    <div className="page-grid">
      <section className="card highlight-card">
        <p className="section-kicker">Live overview</p>
        <h3>Active Visitors</h3>
        <p className="metric">{activeVisitorsCount}</p>
      </section>
      <section className="card highlight-card">
        <p className="section-kicker">Safety</p>
        <h3>Visitor with Violations</h3>
        <p className="metric red">{violationsCount}</p>
      </section>
      <section className="card highlight-card">
        <p className="section-kicker">Today</p>
        <h3>Today&apos;s Visitors</h3>
        <p className="metric">{todayVisitorsCount}</p>
      </section>

      <section className="card summary-card large-panel security-active-card">
        <div className="section-header">
          <div>
            <p className="section-kicker">Active list</p>
            <h3>Current Visitors</h3>
          </div>
          <span className="status-pill status-pill--active">{activeVisitorsList.length} active</span>
        </div>

        {activeVisitorsList.length === 0 ? (
          <div className="empty-state">No active visitors right now.</div>
        ) : (
          <div className="visitor-list visitor-list-scroll">
            {activeVisitorsList.map(function (visitor) {
              // I-set ang default style para sa active visitor card.
              let cardClassName = "visitor-card visitor-card--active";
              let statusLabel = "Active";
              let statusClassName = "status-pill status-pill--active";
              // Tinitingnan kung expired na ang visitor.
              const isAlreadyExpired = isExpired(visitor.endTime);
              // Tinitingnan kung malapit na sa deadline para mag-show ng warning.
              const isNearWarning = isWarning(visitor.endTime);

              // Kung expired na, binabago ang card style at label.
              if (isAlreadyExpired) {
                cardClassName = "visitor-card visitor-card--danger";
                statusLabel = "Expired";
                statusClassName = "status-pill status-pill--expired";
              } else if (isNearWarning) {
                cardClassName = "visitor-card visitor-card--warning";
                statusLabel = "Warning";
                statusClassName = "status-pill status-pill--warning";
              }

              let confirmLabel = "Pending";

              // Kung naka-confirm na ang visitor, ipinapakita ang Done label.
              if (visitor.confirmStatus === "Done") {
                confirmLabel = "Done";
              }

              let timeInLabel = "N/A";

              // Kung may timeIn value, ipinapakita ang oras sa local time format.
              if (visitor.timeIn) {
                timeInLabel = new Date(visitor.timeIn).toLocaleTimeString();
              }

              return (
                <article key={visitor.id} className={cardClassName}>
                  <div className="visitor-card__top">
                    <div>
                      <h4 className="visitor-card__title">{visitor.name}</h4>
                      <p className="visitor-card__subtitle">{visitor.purpose}</p>
                    </div>
                    <span className={statusClassName}>{statusLabel}</span>
                  </div>

                  <div className="visitor-meta">
                    <span>🪪 UID/EPC: {visitor.uid || visitor.epc || "N/A"}</span>
                    <span>📍 {visitor.currentLocation || visitor.location || "Entrance"}</span>
                    <span>🎯 {visitor.destination}</span>
                    <span>✓ Confirm: {confirmLabel}</span>
                    <span>🕒 Time In: {timeInLabel}</span>
                    <span>⏱ Duration: {renderDuration(visitor.duration, visitor.durationUnit || "minutes")}</span>
                    <span>⏳ Time Left: {getRemainingTime(visitor.endTime)}</span>
                  </div>

                  {isNearWarning && <p className="alert-text">⚠ Less than 5 minutes left.</p>}
                  {isAlreadyExpired && <p className="alert-text alert-text--danger">🔴 Visitor has expired.</p>}

                  <div className="visitor-actions">
                    <button className="action-button action-button--danger" onClick={function () {
                      handleDeactivateButtonClick(visitor);
                    }}>
                      Deactivate
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

export function getEpc(visitor) {
  return String(visitor.uid || visitor.epc || "");
}

export function getMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const millis = new Date(value).getTime();
  return Number.isNaN(millis) ? 0 : millis;
}

export function formatTimestamp(value, options) {
  const millis = getMillis(value);
  return millis ? new Intl.DateTimeFormat(undefined, options).format(new Date(millis)) : "N/A";
}

export function formatDate(value) {
  return formatTimestamp(value, { year: "numeric", month: "long", day: "numeric" });
}

export function formatTime(value) {
  return formatTimestamp(value, { hour: "numeric", minute: "2-digit" });
}

export function getDestinations(visitor) {
  if (Array.isArray(visitor.destinations)) return visitor.destinations;
  if (Array.isArray(visitor.destination)) return visitor.destination;
  return visitor.destination ? String(visitor.destination).split(",").map(function (value) { return value.trim(); }).filter(Boolean) : [];
}

export function useSecurityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    let scanRecords = [];
    let visitors = [];
    const histories = new Map();
    const historyUnsubscribers = new Map();

    function publish() {
      const nextLogs = [];

      scanRecords.forEach(function (scan) {
        const scanHistory = histories.get(scan.epc) || [];
        const matchingVisitors = visitors.filter(function (visitor) {
          return getEpc(visitor) === scan.epc;
        });

        matchingVisitors.forEach(function (visitor) {
          const startTime = getMillis(visitor.startTime || visitor.timeIn);
          const endTime = getMillis(visitor.timeOut || visitor.endTime);
          const visitorScans = scanHistory.filter(function (historyItem) {
            const scanTime = getMillis(historyItem.timestamp);
            const startsAfterRegistration = !startTime || scanTime >= startTime;
            const endsBeforeRelease = !endTime || scanTime <= endTime || visitor.status === "active";
            return startsAfterRegistration && endsBeforeRelease;
          }).sort(function (first, second) {
            return getMillis(second.timestamp) - getMillis(first.timestamp);
          });

          nextLogs.push({
            ...scan,
            visitor,
            scans: visitorScans
          });
        });
      });

      setLogs(nextLogs.sort(function (first, second) {
        return getMillis(second.scans[0]?.timestamp || second.lastScan) - getMillis(first.scans[0]?.timestamp || first.lastScan);
      }));
      setLoading(false);
    }

    function syncHistory(scanRecordsValue) {
      const activeEpcs = new Set(scanRecordsValue.map(function (scan) { return scan.epc; }));
      historyUnsubscribers.forEach(function (unsubscribe, epc) {
        if (!activeEpcs.has(epc)) {
          unsubscribe();
          historyUnsubscribers.delete(epc);
          histories.delete(epc);
        }
      });

      scanRecordsValue.forEach(function (scan) {
        if (historyUnsubscribers.has(scan.epc)) return;
        const unsubscribe = onSnapshot(collection(db, "reader_scans", scan.epc, "history"), function (snapshot) {
          histories.set(scan.epc, snapshot.docs.map(function (item) {
            return { id: item.id, ...item.data() };
          }));
          publish();
        });
        historyUnsubscribers.set(scan.epc, unsubscribe);
      });
    }

    const unsubscribeScans = onSnapshot(collection(db, "reader_scans"), function (snapshot) {
      scanRecords = snapshot.docs.map(function (item) {
        return { epc: item.id, ...item.data() };
      });
      syncHistory(scanRecords);
      publish();
    });
    const unsubscribeVisitors = onSnapshot(collection(db, "visitors"), function (snapshot) {
      visitors = snapshot.docs.map(function (item) { return { id: item.id, ...item.data() }; });
      publish();
    });

    return function () {
      unsubscribeScans();
      unsubscribeVisitors();
      historyUnsubscribers.forEach(function (unsubscribe) { unsubscribe(); });
    };
  }, []);

  return { logs, loading };
}

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";

export const SecurityAlertContext = createContext(null);

export function useSecurityAlert() {
  return useContext(SecurityAlertContext);
}

export function SecurityAlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const alertTimersRef = useRef(new Map());

  const getAcknowledgedAlerts = useCallback(function () {
    try {
      const stored = localStorage.getItem("acknowledgedAlerts");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  const setAlertAcknowledged = useCallback(function (alertKey) {
    const acknowledged = getAcknowledgedAlerts();
    acknowledged[alertKey] = true;
    localStorage.setItem("acknowledgedAlerts", JSON.stringify(acknowledged));
  }, [getAcknowledgedAlerts]);

  const isAlertAcknowledged = useCallback(function (alertKey) {
    const acknowledged = getAcknowledgedAlerts();
    return acknowledged[alertKey] === true;
  }, [getAcknowledgedAlerts]);

  const dismissAlert = useCallback(function (alertId) {
    const timer = alertTimersRef.current.get(alertId);
    if (timer) {
      clearTimeout(timer);
      alertTimersRef.current.delete(alertId);
    }

    if (alertId) {
      setAlertAcknowledged(alertId);
    }
    setAlerts(function (currentAlerts) {
      return currentAlerts.filter(function (alert) {
        return alert.id !== alertId;
      });
    });
  }, [setAlertAcknowledged]);

  const pushSecurityAlert = useCallback(function (alert) {
    const alertWithCreatedAt = { ...alert, createdAt: Date.now() };
    setAlerts(function (currentAlerts) {
      if (currentAlerts.some(function (item) {
        return item.id === alert.id;
      })) {
        return currentAlerts;
      }

      return [...currentAlerts, alertWithCreatedAt];
    });

    const timer = setTimeout(function () {
      if (alert.type === "exceed") {
        setAlertAcknowledged(alert.id);
      }
      setAlerts(function (currentAlerts) {
        return currentAlerts.filter(function (item) {
          return item.id !== alert.id;
        });
      });
      alertTimersRef.current.delete(alert.id);
    }, 5000);

    alertTimersRef.current.set(alert.id, timer);
  }, [setAlertAcknowledged]);

  useEffect(function () {
    const timers = alertTimersRef.current;

    return function () {
      timers.forEach(function (timer) {
        clearTimeout(timer);
      });
      timers.clear();
    };
  }, []);

  return (
    <SecurityAlertContext.Provider value={{ alerts, pushSecurityAlert, dismissAlert, isAlertAcknowledged }}>
      {children}
    </SecurityAlertContext.Provider>
  );
}

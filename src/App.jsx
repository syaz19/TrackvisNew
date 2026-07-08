import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { registerAuthSetter, unregisterAuthSetter } from "./authManager";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SecurityLayout from "./layouts/SecurityLayout";
import AuthorizedLayout from "./layouts/AuthorizedLayout";
import SecurityDashboard from "./pages/security/Dashboard";
import RegisterVisitor from "./pages/security/RegisterVisitor";
import History from "./pages/security/History";
import Growth from "./pages/security/Growth";
import AuthorizedDashboard from "./pages/authorized/Dashboard";
import MapView from "./pages/MapView";

function PrivateRoute({ children, user }) {
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const [authState, setAuthState] = useState({ status: "loading", user: null, userData: null });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthState({ status: "ready", user: null, userData: null });
        return;
      }

      try {
        // users documents are keyed by email now
        const userDoc = await getDoc(doc(db, "users", user.email));
        setAuthState({
          status: "ready",
          user,
          userData: userDoc.exists() ? userDoc.data() : null
        });
      } catch {
        setAuthState({ status: "ready", user, userData: null });
      }
    });

    return unsubscribe;
  }, []);

  // register setter so other components can clear auth immediately
  useEffect(() => {
    registerAuthSetter(setAuthState);
    return () => unregisterAuthSetter();
  }, []);

  // Listen for manual logout events from other components to update UI immediately
  useEffect(() => {
    const onLogout = () => setAuthState({ status: "ready", user: null, userData: null });
    window.addEventListener("trackvis-logout", onLogout);
    return () => window.removeEventListener("trackvis-logout", onLogout);
  }, []);

  // Sign out on a fresh browser session, but keep the same tab session alive across refreshes.
  useEffect(() => {
    const unloadKey = "trackvis-pending-unload";
    const sessionKey = "trackvis-session-active";
    const pendingUnload = localStorage.getItem(unloadKey);
    const isReload = sessionStorage.getItem(sessionKey) === "1";

    if (pendingUnload && !isReload) {
      queueMicrotask(() => {
        setAuthState({ status: "ready", user: null, userData: null });
      });
      signOut(auth).catch(() => {
        /* ignore errors during initial sign-out */
      });
    }

    sessionStorage.setItem(sessionKey, "1");
    localStorage.removeItem(unloadKey);

    const handleUnload = () => {
      localStorage.setItem(unloadKey, "1");
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, []);

  if (authState.status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f172a", color: "#fff" }}>
        <p>Loading TrackVis...</p>
      </div>
    );
  }

  const getRedirect = () => {
    if (authState.userData?.role === "security") return <Navigate to="/security" replace />;
    if (authState.userData?.role === "authorized") return <Navigate to="/authorized" replace />;
    return <Navigate to="/" replace />;
  };

  return (
    <Routes>
      <Route path="/" element={authState.user ? getRedirect() : <Login />} />
      <Route path="/signup" element={authState.user ? getRedirect() : <Signup />} />
      <Route
        path="/security"
        element={
          <PrivateRoute user={authState.user}>
            <SecurityLayout>
              <SecurityDashboard />
            </SecurityLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/security/register"
        element={
          <PrivateRoute user={authState.user}>
            <SecurityLayout>
              <RegisterVisitor />
            </SecurityLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/security/history"
        element={
          <PrivateRoute user={authState.user}>
            <SecurityLayout>
              <History />
            </SecurityLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/security/growth"
        element={
          <PrivateRoute user={authState.user}>
            <SecurityLayout>
              <Growth />
            </SecurityLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/authorized"
        element={
          <PrivateRoute user={authState.user}>
            <AuthorizedLayout>
              <AuthorizedDashboard />
            </AuthorizedLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/security/map"
        element={
          <PrivateRoute user={authState.user}>
            <SecurityLayout>
              <MapView />
            </SecurityLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/authorized/map"
        element={
          <PrivateRoute user={authState.user}>
            <AuthorizedLayout>
              <MapView />
            </AuthorizedLayout>
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

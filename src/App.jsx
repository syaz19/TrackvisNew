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

const initialAuthState = { status: "loading", user: null, userData: null };

function PrivateRoute({ children, user }) {
  if (user) {
    return children;
  }

  return <Navigate to="/" replace />;
}

function buildAuthState(user, userData, status = "ready") {
  return { status, user, userData };
}

function getRedirectPath(userData) {
  if (userData !== null && userData.role === "security") {
    return "/security";
  }

  if (userData !== null && userData.role === "authorized") {
    return "/authorized";
  }

  return "/";
}

export default function App() {
  const [authState, setAuthState] = useState(initialAuthState);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthState(buildAuthState(null, null));
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.email));
        let userData = null;

        if (userDoc.exists()) {
          userData = userDoc.data();
        }

        setAuthState(buildAuthState(user, userData));
      } catch {
        setAuthState(buildAuthState(user, null));
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    registerAuthSetter(setAuthState);
    return unregisterAuthSetter;
  }, []);

  useEffect(() => {
    function handleLogout() {
      setAuthState(buildAuthState(null, null));
    }

    window.addEventListener("trackvis-logout", handleLogout);
    return () => window.removeEventListener("trackvis-logout", handleLogout);
  }, []);

  useEffect(() => {
    const unloadKey = "trackvis-pending-unload";
    const sessionKey = "trackvis-session-active";
    const pendingUnload = localStorage.getItem(unloadKey);
    const isReload = sessionStorage.getItem(sessionKey) === "1";

    if (pendingUnload && !isReload) {
      queueMicrotask(() => {
        setAuthState(buildAuthState(null, null));
      });
      signOut(auth).catch(() => {
        // ignore errors during initial sign-out
      });
    }

    sessionStorage.setItem(sessionKey, "1");
    localStorage.removeItem(unloadKey);

    function handleUnload() {
      localStorage.setItem(unloadKey, "1");
    }

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

  const redirectPath = getRedirectPath(authState.userData);
  const protectedRoutes = [
    { path: "/security", element: <SecurityDashboard />, layout: SecurityLayout },
    { path: "/security/register", element: <RegisterVisitor />, layout: SecurityLayout },
    { path: "/security/history", element: <History />, layout: SecurityLayout },
    { path: "/security/growth", element: <Growth />, layout: SecurityLayout },
    { path: "/authorized", element: <AuthorizedDashboard />, layout: AuthorizedLayout },
    { path: "/security/map", element: <MapView />, layout: SecurityLayout },
    { path: "/authorized/map", element: <MapView />, layout: AuthorizedLayout }
  ];

  return (
    <Routes>
      <Route path="/" element={authState.user ? <Navigate to={redirectPath} replace /> : <Login />} />
      <Route path="/signup" element={authState.user ? <Navigate to={redirectPath} replace /> : <Signup />} />

      {protectedRoutes.map((route) => {
        const Layout = route.layout;

        return (
          <Route
            key={route.path}
            path={route.path}
            element={
              <PrivateRoute user={authState.user}>
                <Layout>{route.element}</Layout>
              </PrivateRoute>
            }
          />
        );
      })}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

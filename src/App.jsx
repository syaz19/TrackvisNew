import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { registerAuthSetter, unregisterAuthSetter } from "./authManager";
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

// Ginagamit ang initial state habang naglo-load ang app.
const initialAuthState = { status: "loading", user: null, userData: null };

function PrivateRoute({ children, user }) {
  // Kung may logged-in user, ipakita ang page; kung wala, ibalik sa login.
  if (user) {
    return children;
  }

  return <Navigate to="/" replace />;
}

function buildAuthState(user, userData, status = "ready") {
  // Pinapadali ang pagbuo ng auth state sa bawat update.
  return { status, user, userData };
}

function getRedirectPath(userData) {
  // Pinipili ang tamang landing page base sa role ng user.
  if (userData?.role === "security") {
    return "/security";
  }

  if (userData?.role === "authorized") {
    return "/authorized";
  }

  return "/";
}

export default function App() {
  // Ini-store ang current authentication state sa component.
  const [authState, setAuthState] = useState(initialAuthState);

  useEffect(() => {
    // Pinapansin ang Firebase auth state para malaman kung naka-login o hindi.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthState(buildAuthState(null, null));
        return;
      }

      try {
        // Kinukuha ang data ng user sa Firestore base sa email.
        const userDoc = await getDoc(doc(db, "users", user.email));
        const userData = userDoc.exists() ? userDoc.data() : null;

        setAuthState(buildAuthState(user, userData));
      } catch {
        setAuthState(buildAuthState(user, null));
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // I-register ang setter para magamit ng ibang module.
    registerAuthSetter(setAuthState);
    return unregisterAuthSetter;
  }, []);

  useEffect(() => {
    // Kapag may logout event, reset ang auth state.
    function handleLogout() {
      setAuthState(buildAuthState(null, null));
    }

    window.addEventListener("trackvis-logout", handleLogout);
    return () => window.removeEventListener("trackvis-logout", handleLogout);
  }, []);

  useEffect(() => {
    // Ginagamit ang local/session storage para maiwasan ang stuck session sa reload.
    const unloadKey = "trackvis-pending-unload";
    const sessionKey = "trackvis-session-active";
    const pendingUnload = localStorage.getItem(unloadKey);
    const isReload = sessionStorage.getItem(sessionKey) === "1";

    if (pendingUnload && !isReload) {
      queueMicrotask(() => {
        setAuthState(buildAuthState(null, null));
      });

      signOut(auth).catch(() => {
        // Hindi mahalaga kung may error sa unang sign out.
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

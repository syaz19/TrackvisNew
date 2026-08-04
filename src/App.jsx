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
// Default ready state ensures the login screen renders immediately
// even before Firebase auth is resolved on fresh deploy.
const initialAuthState = { status: "ready", user: null, userData: null };

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
  // Piliin ang tamang home page base sa role ng user.
  if (userData !== null && userData !== undefined) {
    if (userData.role === "security") {
      return "/security/map";
    }

    if (userData.role === "authorized") {
      return "/authorized/map";
    }
  }

  return "/";
}

export default function App() {
  // I-store ang current auth state sa component.
  const [authState, setAuthState] = useState(initialAuthState);

  useEffect(function () {
    // Step 1: pakinggan ang Firebase auth state.
    // Step 2: kung may user, kunin ang user data sa Firestore.
    // Step 3: i-update ang auth state sa app.
    async function handleAuthStateChange(loggedInUser) {
      if (!loggedInUser) {
        const emptyState = buildAuthState(null, null);
        setAuthState(emptyState);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", loggedInUser.email));
        let userData = null;

        if (userDoc.exists()) {
          userData = userDoc.data();
        }

        const nextState = buildAuthState(loggedInUser, userData);
        setAuthState(nextState);
      } catch {
        const fallbackState = buildAuthState(loggedInUser, null);
        setAuthState(fallbackState);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, handleAuthStateChange);

    return unsubscribe;
  }, []);

  useEffect(function () {
    // I-register ang setter para magamit ng ibang module.
    registerAuthSetter(setAuthState);
    return unregisterAuthSetter;
  }, []);

  useEffect(function () {
    // Kapag may logout event, i-reset ang auth state.
    function handleLogout() {
      setAuthState(buildAuthState(null, null));
    }

    window.addEventListener("trackvis-logout", handleLogout);
    return function () {
      window.removeEventListener("trackvis-logout", handleLogout);
    };
  }, []);

  useEffect(function () {
    // Ginagamit ang local at session storage para maiwasan ang stuck session sa reload.
    const unloadKey = "trackvis-pending-unload";
    const sessionKey = "trackvis-session-active";
    const pendingUnload = localStorage.getItem(unloadKey);
    const isReload = sessionStorage.getItem(sessionKey) === "1";

    if (pendingUnload && !isReload) {
      queueMicrotask(function () {
        setAuthState(buildAuthState(null, null));
      });

      signOut(auth).catch(function () {
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

    return function () {
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

  const homePath = getRedirectPath(authState.userData);
  const routesThatNeedProtection = [
    { path: "/security", element: <SecurityDashboard />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/register", element: <RegisterVisitor />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/history", element: <History />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/growth", element: <Growth />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/authorized", element: <AuthorizedDashboard />, layout: AuthorizedLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/map", element: <MapView />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true, isSmallTitle: true, title: "SCC 3D" } },
    { path: "/authorized/map", element: <MapView />, layout: AuthorizedLayout, layoutProps: { hideTitle: false, hideSubtitle: true, isSmallTitle: true, title: "SCC 3D" } }
  ];

  let loginRouteElement = <Login />;
  let signupRouteElement = <Signup />;

  if (authState.user) {
    loginRouteElement = <Navigate to={homePath} replace />;
    signupRouteElement = <Navigate to={homePath} replace />;
  }

  return (
    <Routes>
      <Route path="/" element={loginRouteElement} />
      <Route path="/signup" element={signupRouteElement} />

      {routesThatNeedProtection.map(function (route) {
        const Layout = route.layout;

        return (
          <Route
            key={route.path}
            path={route.path}
            element={
              <PrivateRoute user={authState.user}>
                <Layout currentUser={authState.user} userData={authState.userData} {...(route.layoutProps || {})}>
                  {route.element}
                </Layout>
              </PrivateRoute>
            }
          />
        );
      })}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

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
import AuthorizedHistory from "./pages/authorized/History";
import AccountPage from "./pages/Account";
import MapView from "./pages/MapView";
import Logs from "./pages/security/Logs";
import LogDetails from "./pages/security/LogDetails";


const initialAuthState = { status: "ready", user: null, userData: null };


function PrivateRoute({ children, user }) {
  if (user) {
    return children;
  }

  return <Navigate to="/" replace />;
}


function SecurityRoute({ children, user, userData }) {
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!userData || userData.role !== "security") {
    return <Navigate to={getRedirectPath(userData)} replace />;
  }

  return children;
}


function buildAuthState(user, userData, status = "ready") {
  return { status, user, userData };
}


function getRedirectPath(userData) {
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
 
  const [authState, setAuthState] = useState(initialAuthState);

  
  useEffect(function () {
    
    async function handleAuthStateChange(loggedInUser) {
      const isPendingSignup = sessionStorage.getItem("trackvis-signup-pending") === "1";

      if (isPendingSignup) {
        const emptyState = buildAuthState(null, null);
        setAuthState(emptyState);

        if (!loggedInUser) {
          sessionStorage.removeItem("trackvis-signup-pending");
        }

        return;
      }

      if (!loggedInUser) {
        const emptyState = buildAuthState(null, null);
        setAuthState(emptyState);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", loggedInUser.email));

        if (!userDoc.exists()) {
          await signOut(auth);
          setAuthState(buildAuthState(null, null));
          return;
        }

        const userData = userDoc.data();
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
    registerAuthSetter(setAuthState);
    return unregisterAuthSetter;
  }, []);

  
  useEffect(function () {
    function handleLogout() {
      setAuthState(buildAuthState(null, null));
    }

    window.addEventListener("trackvis-logout", handleLogout);
    return function () {
      window.removeEventListener("trackvis-logout", handleLogout);
    };
  }, []);

  
  
  useEffect(function () {
    const unloadKey = "trackvis-pending-unload";
    const sessionKey = "trackvis-session-active";
    const pendingUnload = localStorage.getItem(unloadKey);
    const isReload = sessionStorage.getItem(sessionKey) === "1";

    if (pendingUnload && !isReload) {
      queueMicrotask(function () {
        setAuthState(buildAuthState(null, null));
      });

      signOut(auth).catch(function () {
        
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
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#090D1A", color: "#F8FAFC" }}>
        <p>Loading TrackVis...</p>
      </div>
    );
  }

  
  const isAuthenticated = Boolean(authState.user && authState.userData);

  
  const homePath = isAuthenticated ? getRedirectPath(authState.userData) : "/";
  
  const routesThatNeedProtection = [
    { path: "/security", element: <SecurityDashboard />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/register", element: <RegisterVisitor />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/history", element: <History />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/growth", element: <Growth />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/logs", element: <Logs />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true }, securityOnly: true },
    { path: "/security/logs/:epc", element: <LogDetails />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true }, securityOnly: true },
    { path: "/security/logs/:epc/:visitorId", element: <LogDetails />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true }, securityOnly: true },
    { path: "/security/account", element: <AccountPage currentUser={authState.user} userData={authState.userData} />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/authorized", element: <AuthorizedDashboard />, layout: AuthorizedLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/authorized/history", element: <AuthorizedHistory />, layout: AuthorizedLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/authorized/account", element: <AccountPage currentUser={authState.user} userData={authState.userData} />, layout: AuthorizedLayout, layoutProps: { hideTitle: false, hideSubtitle: true } },
    { path: "/security/map", element: <MapView />, layout: SecurityLayout, layoutProps: { hideTitle: false, hideSubtitle: true, isSmallTitle: true, title: "SCC 3D" } },
    { path: "/authorized/map", element: <MapView />, layout: AuthorizedLayout, layoutProps: { hideTitle: false, hideSubtitle: true, isSmallTitle: true, title: "SCC 3D" } }
  ];

  
  let loginRouteElement = <Login />;
  let signupRouteElement = <Signup />;

  if (isAuthenticated) {
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
              route.securityOnly ? (
                <SecurityRoute user={authState.user} userData={authState.userData}>
                  <Layout currentUser={authState.user} userData={authState.userData} {...(route.layoutProps || {})}>
                    {route.element}
                  </Layout>
                </SecurityRoute>
              ) : (
                <PrivateRoute user={authState.user}>
                  <Layout currentUser={authState.user} userData={authState.userData} {...(route.layoutProps || {})}>
                    {route.element}
                  </Layout>
                </PrivateRoute>
              )
            }
          />
        );
      })}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

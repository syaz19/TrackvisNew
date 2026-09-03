import { useEffect, useState, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, updateDoc } from "firebase/firestore";
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


const initialAuthState = { status: "ready", user: null, userData: null };


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

  
  const previousVisitorsRef = useRef({});
  useEffect(function () {
    
    if (!authState.user || !authState.userData) {
      return;
    }

    const userRole = authState.userData.role;
    const userSubRole = authState.userData.subRole;

  
    function getVisitorLocationKey(visitor) {
      const locationName = (visitor.currentLocation || visitor.location || "").toString().toLowerCase();
      if (locationName.includes("office")) {
        return "office";
      }
      if (locationName.includes("library")) {
        return "library";
      }
      return "entrance";
    }

    
    function shouldShowAlertForUser(visitor) {
      
      if (userRole === "security") {
        return true;
      }

      
      if (userRole === "authorized") {
        
        const destinations = Array.isArray(visitor.destinations)
          ? visitor.destinations
          : (visitor.destination || "").toString().split(",").map(function (d) { return d.trim(); }).filter(Boolean);

        
        return destinations.some(function (dest) {
          return dest.toLowerCase() === (userSubRole || "").toString().toLowerCase();
        });
      }

      return false;
    }

    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      const visitorList = snapshot.docs.map(function (item) {
        return { id: item.id, ...item.data() };
      });

     
      visitorList.forEach(function (currentVisitor) {
        const previousVisitor = previousVisitorsRef.current[currentVisitor.id];

        if (!previousVisitor) {
          
          previousVisitorsRef.current[currentVisitor.id] = currentVisitor;
          return;
        }

      
        const previousLocationKey = getVisitorLocationKey(previousVisitor);
        const currentLocationKey = getVisitorLocationKey(currentVisitor);

        
        if (previousLocationKey !== "office" && currentLocationKey === "office") {
          
          if (!currentVisitor.officeEntryAlerted && shouldShowAlertForUser(currentVisitor)) {
            
            const visitorName = currentVisitor.name || "Unknown";
            window.alert(`Our visitor ${visitorName} enter office`);

          
            try {
              updateDoc(doc(db, "visitors", currentVisitor.id), {
                officeEntryAlerted: true
              }).catch(function (error) {
                console.error("Failed to update officeEntryAlerted:", error);
              });
            } catch (error) {
              console.error("Error updating officeEntryAlerted:", error);
            }
          }
        }

        
        if (previousLocationKey === "office" && currentLocationKey !== "office") {
        
          if (currentVisitor.officeEntryAlerted) {
            try {
              updateDoc(doc(db, "visitors", currentVisitor.id), {
                officeEntryAlerted: false
              }).catch(function (error) {
                console.error("Failed to reset officeEntryAlerted:", error);
              });
            } catch (error) {
              console.error("Error resetting officeEntryAlerted:", error);
            }
          }
        }

       
        previousVisitorsRef.current[currentVisitor.id] = currentVisitor;
      });

     
      Object.keys(previousVisitorsRef.current).forEach(function (id) {
        if (!visitorList.find(function (x) { return x.id === id; })) {
          delete previousVisitorsRef.current[id];
        }
      });
    });

    return function () {
      unsubscribe();
    };
  }, [authState.user, authState.userData]);

  
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

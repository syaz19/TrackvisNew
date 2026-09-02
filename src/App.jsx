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

// initialAuthState:
// Ito ang default value ng app habang kinukuha pa ang auth state.
// Ang app ay ready na pero walang user pa hanggang ma-resolve ang Firebase auth.
const initialAuthState = { status: "ready", user: null, userData: null };

// PrivateRoute:
// Tinitingnan kung may logged-in user.
// Kung may user, papayagan ang page; kung wala, ibabalik sa login page.
function PrivateRoute({ children, user }) {
  if (user) {
    return children;
  }

  return <Navigate to="/" replace />;
}

// buildAuthState:
// Helper function para madaling i-construct ang auth state.
// Kabilang dito ang status, user, at Firestore userData.
function buildAuthState(user, userData, status = "ready") {
  return { status, user, userData };
}

// getRedirectPath:
// Tinutukoy kung saan dapat pumunta ang user pagkatapos mag-login.
// Kung security, map page ng security; kung authorized, map page ng authorized.
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

// App:
// Ito ang root component ng app.
// Dito pinapamahalaan ang authentication, role-based routing, at protected pages.
export default function App() {
  // authState: current state ng user at role data.
  const [authState, setAuthState] = useState(initialAuthState);

  // useEffect na ito: nakikinig sa Firebase auth state.
  // Kapag may change sa login/logout, i-update dito ang authState ng app.
  useEffect(function () {
    // Step 1: pakinggan ang Firebase auth state.
    // Step 2: kung may user, kunin ang user data sa Firestore.
    // Step 3: i-update ang auth state sa app.
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

  // useEffect na ito: i-register ang auth setter para magamit ito ng ibang file.
  // Halimbawa, may logout flow sa ibang bahagi ng app na dapat mag-update ng auth state.
  useEffect(function () {
    registerAuthSetter(setAuthState);
    return unregisterAuthSetter;
  }, []);

  // useEffect na ito: nakikinig sa custom logout event.
  // Kapag may logout event, i-reset ang auth state para mag-log out ang user sa app.
  useEffect(function () {
    function handleLogout() {
      setAuthState(buildAuthState(null, null));
    }

    window.addEventListener("trackvis-logout", handleLogout);
    return function () {
      window.removeEventListener("trackvis-logout", handleLogout);
    };
  }, []);

  // useEffect na ito: Global office entry alert listener.
  // Tumatakbo sa lahat ng pages dahil ito ay nasa App component (root).
  // Nag-filter based on user role at destination para sa authorized users.
  const previousVisitorsRef = useRef({});
  useEffect(function () {
    // Kung wala pang user, huwag mag-subscribe sa visitors.
    if (!authState.user || !authState.userData) {
      return;
    }

    const userRole = authState.userData.role;
    const userSubRole = authState.userData.subRole;

    // Function para malaman kung ang location ay "office".
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

    // Function para malaman kung dapat ipakita ang alert para sa current user.
    function shouldShowAlertForUser(visitor) {
      // Security users: makikita lahat ng alerts
      if (userRole === "security") {
        return true;
      }

      // Authorized users: makikita lang ang alerts ng visitors na assigned sa kanila
      if (userRole === "authorized") {
        // Kunin ang destinations ng visitor
        const destinations = Array.isArray(visitor.destinations)
          ? visitor.destinations
          : (visitor.destination || "").toString().split(",").map(function (d) { return d.trim(); }).filter(Boolean);

        // Check kung ang user's subRole ay included sa visitor's destinations
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

      // Detect office entry/exit at handle alerts
      visitorList.forEach(function (currentVisitor) {
        const previousVisitor = previousVisitorsRef.current[currentVisitor.id];

        if (!previousVisitor) {
          // New visitor, store it lang
          previousVisitorsRef.current[currentVisitor.id] = currentVisitor;
          return;
        }

        // Get location keys
        const previousLocationKey = getVisitorLocationKey(previousVisitor);
        const currentLocationKey = getVisitorLocationKey(currentVisitor);

        // Check if visitor entered office (location changed to office)
        if (previousLocationKey !== "office" && currentLocationKey === "office") {
          // Visitor just entered office - check kung dapat ipakita ang alert para sa current user
          if (!currentVisitor.officeEntryAlerted && shouldShowAlertForUser(currentVisitor)) {
            // Show alert only if not already alerted at user is authorized to see it
            const visitorName = currentVisitor.name || "Unknown";
            window.alert(`Our visitor ${visitorName} enter office`);

            // Update Firestore to mark alert as shown
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

        // Check if visitor left office (location changed away from office)
        if (previousLocationKey === "office" && currentLocationKey !== "office") {
          // Visitor left office, reset alert state
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

        // Update the previous visitor record
        previousVisitorsRef.current[currentVisitor.id] = currentVisitor;
      });

      // Cleanup removed visitors from previousVisitorsRef
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

  // useEffect na ito: tinutukoy kung may pending unload o reload session.
  // Ginagamit ang localStorage at sessionStorage para maiwasan ang stuck session pag nag-refresh ang page.
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

  // Kung hindi pa tapos ang auth load, ipapakita ang loading screen.
  if (authState.status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#090D1A", color: "#F8FAFC" }}>
        <p>Loading TrackVis...</p>
      </div>
    );
  }

  // isAuthenticated: true lang kapag may user at may matched Firestore record.
  const isAuthenticated = Boolean(authState.user && authState.userData);

  // homePath: destination ng user pagkatapos mag-login.
  const homePath = isAuthenticated ? getRedirectPath(authState.userData) : "/";
  // routesThatNeedProtection:
  // Listahan ng mga page na kailangan ng valid login.
  // Bawat route may layout at element na dapat ipakita kapag may access.
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

  // loginRouteElement at signupRouteElement:
  // Kung naka-login na ang user, dapat hindi na ma-access ang login/signup page.
  let loginRouteElement = <Login />;
  let signupRouteElement = <Signup />;

  if (isAuthenticated) {
    loginRouteElement = <Navigate to={homePath} replace />;
    signupRouteElement = <Navigate to={homePath} replace />;
  }

  // Render ng app routes:
  // - public routes: login at signup
  // - protected routes: security/authorized pages wrapped in layouts
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

// MapView.jsx
// Layunin: Pinapakita ang SCC 3D campus model at visitor marker UI.
// - Naglo-load ng /models/newschools.glb sa canvas.
// - Nagpapakita ng visitor markers mula sa Firestore.
// - May loading overlay at office scan alert.

// import ng React hooks at utilities.
import { Suspense, Component, memo, useEffect, useState, useMemo, useRef } from "react";
// import ng Canvas at useThree para sa 3D scene.
import { Canvas, useThree } from "@react-three/fiber";
// import ng Drei utilities para sa controls, model loading, at HTML overlay.
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
// import ng THREE.js core library para sa raycaster at vector math.
import * as THREE from "three";
// import ng Firestore methods para sa live listener at dokumento.
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
// import ng Firebase instances para sa auth at db.
import { auth, db } from "../firebase";
// import ng dashboard components para ipakita kapag naka-security/authorized.
import SecurityDashboard from "./security/Dashboard";
import AuthorizedDashboard from "./authorized/Dashboard";

// mga kulay na ginagamit para sa visitor markers.
const markerColors = ["#ef4444", "#f59e0b", "#38bdf8", "#22c55e", "#a855f7"];
// base URL ng 3D model asset.
const BASE_MODEL_URL = `${import.meta.env.BASE_URL}models/newschools.glb`;
// cache-busted URL para iwas cache stale model.
const BASE_MODEL_URL_WITH_CACHE_BUST = `${BASE_MODEL_URL}?v=${Date.now()}`;
// preload ng GLTF model bago mag-render para mas mabilis.
useGLTF.preload(BASE_MODEL_URL_WITH_CACHE_BUST);

function LoadingOverlay() {
  // Overlay na nakalagay sa ibabaw ng canvas habang naglo-load ang 3D model.
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 100000 }}>
      <div style={{ pointerEvents: "auto", background: "rgba(35, 35, 36, 0.92)", color: "#fff", padding: "20px 28px", borderRadius: 12, boxShadow: "0 12px 36px rgba(0,0,0,0.6)", textAlign: "center", fontWeight: 500, letterSpacing: "0.08em" }}>
        <div style={{ fontSize: 10 }}>LOADING SAN CARLOS COLLEGE 3D MODEL</div>
      </div>
    </div>
  );
}

// Mga anchor positions para sa bawat location marker sa 3D campus model.
const locationMarkers = {
  library: {
    position: [-11, 1.2, -1.2]
  },
  office: {
    position: [-30, 1.2, -30]
  },
  entrance: {
    position: [50, 1.2, -43]
  }
};

// Base key para sa session storage ng camera state.
const CAMERA_STORAGE_BASE_KEY = "trackvis-school-3d-camera";
const DEFAULT_CAMERA_STATE = {
  position: [-70, 25, -75],
  target: [0, 0, 0],
  zoomDistance: 140
};

function getCameraStorageKey() {
  // Kung walang browser window, fallback sa global key.
  if (typeof window === "undefined") {
    return CAMERA_STORAGE_BASE_KEY;
  }

  const user = auth.currentUser;
  if (user && user.uid) {
    return `${CAMERA_STORAGE_BASE_KEY}-${user.uid}`;
  }

  return CAMERA_STORAGE_BASE_KEY;
}

function loadSavedCameraState() {
  // Kunin ang na-save na camera state mula sessionStorage.
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const key = getCameraStorageKey();
    const stored = window.sessionStorage.getItem(key);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.position) || !Array.isArray(parsed.target)) {
      return null;
    }

    return {
      position: parsed.position,
      target: parsed.target,
      zoomDistance: parsed.zoomDistance || DEFAULT_CAMERA_STATE.zoomDistance
    };
  } catch {
    return null;
  }
}

function saveCameraState(state) {
  // I-save ang kasalukuyang camera state sa browser sessionStorage.
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getCameraStorageKey();
    window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore write failures
  }
}

function clearCameraState(userUid = null) {
  // Tanggalin ang session storage entries kapag nag-logout o nag-reset ng user.
  if (typeof window === "undefined") {
    return;
  }

  try {
    const keysToClear = [CAMERA_STORAGE_BASE_KEY];
    if (typeof userUid === "string" && userUid.trim() !== "") {
      keysToClear.push(`${CAMERA_STORAGE_BASE_KEY}-${userUid}`);
    } else {
      const currentUser = auth.currentUser;
      if (currentUser?.uid) {
        keysToClear.push(`${CAMERA_STORAGE_BASE_KEY}-${currentUser.uid}`);
      }
    }

    keysToClear.forEach((key) => {
      window.sessionStorage.removeItem(key);
    });
  } catch {
    // ignore remove failures
  }
}

function getVisitorLocationKey(visitor) {
  // I-map ang visitor record sa isang predefined na location key.
  // Kung wala sa office/library ang pangalan, ituturing itong entrance.
  const locationName = (visitor.currentLocation || visitor.location || "").toString().toLowerCase();
  if (locationName.includes("office")) {
    return "office";
  }
  if (locationName.includes("library")) {
    return "library";
  }
  return "entrance";
}

function getLocationAnchor(locationKey) {
  // Kumuha ng 3D anchor position batay sa location key.
  return locationMarkers[locationKey] || locationMarkers.library;
}

function PartLabel({ portal, locationKey, label }) {
  // HTML label na naka-overlay sa 3D position ng location anchor.
  const anchor = getLocationAnchor(locationKey);
  const textPosition = [anchor.position[0], anchor.position[1] + 8.8, anchor.position[2]];

  return (
    <Html portal={portal} position={textPosition} center style={{ pointerEvents: "none", zIndex: 0 }} distanceFactor={24}>
      <div
        style={{
          padding: "14px 22px",
          borderRadius: "999px",
          background: "rgba(15, 23, 42, 0.98)",
          color: "#f8fafc",
          border: "1px solid rgba(96, 165, 250, 0.35)",
          fontSize: "18px",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          lineHeight: 1.1,
          boxShadow: "0 16px 36px rgba(0,0,0,0.28)",
          zIndex: 0
        }}
      >
        {label}
      </div>
    </Html>
  );
}

function VisitorMarker({ portal, visitor, locationKey, groupIndex }) {
  // maliit na sphere marker at label para sa bawat visitor sa 3D model.
  const anchor = getLocationAnchor(locationKey);
  const radius = groupIndex === 0 ? 0 : 1.05;
  const angle = groupIndex * Math.PI * 0.75;
  const position = [
    anchor.position[0] + (groupIndex === 0 ? 0 : Math.cos(angle) * radius),
    anchor.position[1],
    anchor.position[2] + (groupIndex === 0 ? 0 : Math.sin(angle) * radius)
  ];
  const color = markerColors[groupIndex % markerColors.length];

  return (
    <group>
      <mesh position={position}>
        <sphereGeometry args={[0.5, 28, 28]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html portal={portal} position={[position[0], position[1] + 0.95, position[2]]} center style={{ pointerEvents: "none", zIndex: 0 }}>
        <div
          style={{
            background: "rgba(15, 23, 42, 0.96)",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: "999px",
            fontSize: "12px",
            whiteSpace: "nowrap",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.18)",
            zIndex: 0
          }}
        >
          {visitor.name || visitor.id}
        </div>
      </Html>
    </group>
  );
}

function SchoolModel({ sceneRef, modelUrl, setModelLoaded }) {
  // Naglo-load ng GLTF model at inaayos ang mesh shadow properties.
  const { scene } = useGLTF(modelUrl);

  useEffect(() => {
    // mark loaded after scene is available
    try {
      scene.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
    } catch {
      // ignore
    }

    if (typeof setModelLoaded === "function") {
      setModelLoaded(true);
    }

    return () => {
      if (typeof setModelLoaded === "function") {
        setModelLoaded(false);
      }
    };
  }, [scene, setModelLoaded]);

  return <primitive ref={sceneRef} object={scene} dispose={null} scale={0.18} position={[0, -1.1, 0]} />;
}

const MemoizedMapScene = memo(function MapScene({ cameraState, modelUrl, markersByLocation, sceneRef, controlsRef, showLabels, showMarkers, portal, setModelLoaded }) {
  // Mataas na level ng 3D scene; memoized para maiwasan ang unnecessary rerender.
  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      dpr={[1, 1.2]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      performance={{ min: 0.4, max: 0.85, debounce: 50 }}
      camera={{ position: cameraState.position, fov: 35, near: 0.1, far: 1000 }}
    >
      <ambientLight intensity={1.3} color="#ffffff" />
      <hemisphereLight intensity={1.1} skyColor="#ffffff" groundColor="#666666" />
      <directionalLight position={[10, 18, 10]} intensity={1.6} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-16, 12, -12]} intensity={0.95} color="#ffe8c8" />
      <pointLight position={[8, 12, -10]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-10, 12, 8]} intensity={0.7} color="#ffffff" />
      <pointLight position={[0, 10, 0]} intensity={0.55} color="#dbeafe" />
      <ModelErrorBoundary>
        <Suspense fallback={null}>
          <SchoolModel sceneRef={sceneRef} modelUrl={modelUrl} setModelLoaded={setModelLoaded} />
          {showLabels && (
            <>
              <PartLabel portal={portal} locationKey="library" label="LIBRARY PART" />
              <PartLabel portal={portal} locationKey="office" label="OFFICE PART" />
              <PartLabel portal={portal} locationKey="entrance" label="ENTRANCE PART" />
            </>
          )}
          {showMarkers && markersByLocation.entrance.map((visitor, index) => (
            <VisitorMarker key={visitor.id || `${visitor.uid}-entrance-${index}`} portal={portal} visitor={visitor} locationKey="entrance" groupIndex={index} />
          ))}
          {showMarkers && markersByLocation.library.map((visitor, index) => (
            <VisitorMarker key={visitor.id || `${visitor.uid}-library-${index}`} portal={portal} visitor={visitor} locationKey="library" groupIndex={index} />
          ))}
          {showMarkers && markersByLocation.office.map((visitor, index) => (
            <VisitorMarker key={visitor.id || `${visitor.uid}-office-${index}`} portal={portal} visitor={visitor} locationKey="office" groupIndex={index} />
          ))}
        </Suspense>
      </ModelErrorBoundary>
      <CameraControls controlsRef={controlsRef} initialState={cameraState} />
      <DoubleClickZoom sceneRef={sceneRef} controlsRef={controlsRef} />
    </Canvas>
  );
});

function CameraControls({ controlsRef, initialState }) {
  // OrbitControls setup at initial camera position.
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...initialState.position);
    if (controlsRef.current) {
      controlsRef.current.target.set(...initialState.target);
      controlsRef.current.update();
    }
  }, [camera, controlsRef, initialState]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const saveCurrentCamera = () => {
      const position = controls.object.position;
      const target = controls.target;
      const zoomDistance = position.distanceTo(target);
      saveCameraState({
        position: [position.x, position.y, position.z],
        target: [target.x, target.y, target.z],
        zoomDistance
      });
    };

    controls.addEventListener("change", saveCurrentCamera);
    controls.addEventListener("end", saveCurrentCamera);
    return () => {
      controls.removeEventListener("change", saveCurrentCamera);
      controls.removeEventListener("end", saveCurrentCamera);
    };
  }, [controlsRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.7}
      zoomSpeed={1}
      panSpeed={0.8}
      screenSpacePanning={false}
      minDistance={2}
      maxDistance={500}
    />
  );
}

function DoubleClickZoom({ sceneRef, controlsRef }) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    if (!gl?.domElement) {
      return undefined;
    }

    let animationFrame = null;

    const animateCamera = (startCamera, startTarget, endCamera, endTarget, onComplete) => {
      const duration = 450;
      const startTime = performance.now();

      const tick = (timestamp) => {
        const t = Math.min(1, (timestamp - startTime) / duration);
        const ease = t * (2 - t);

        camera.position.lerpVectors(startCamera, endCamera, ease);
        controlsRef.current.target.lerpVectors(startTarget, endTarget, ease);
        controlsRef.current.update();

        if (t < 1) {
          animationFrame = requestAnimationFrame(tick);
        } else if (typeof onComplete === "function") {
          onComplete();
        }
      };

      animationFrame = requestAnimationFrame(tick);
    };

    const handleDoubleClick = (event) => {
      if (!sceneRef.current || !controlsRef.current) {
        return;
      }

      const rect = gl.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const intersects = raycaster.intersectObject(sceneRef.current, true);
      if (intersects.length === 0) {
        return;
      }

      const hitPoint = intersects[0].point.clone();
      const viewDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
      const currentDistance = camera.position.distanceTo(hitPoint);
      const zoomDistance = Math.max(16, currentDistance * 0.6);
      const endPosition = hitPoint.clone().add(viewDirection.multiplyScalar(-zoomDistance));
      const startPosition = camera.position.clone();
      const startTarget = controlsRef.current.target.clone();

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      animateCamera(startPosition, startTarget, endPosition, hitPoint, () => {
        saveCameraState({
          position: [endPosition.x, endPosition.y, endPosition.z],
          target: [hitPoint.x, hitPoint.y, hitPoint.z],
          zoomDistance
        });
      });
    };

    gl.domElement.addEventListener("dblclick", handleDoubleClick);

    return () => {
      gl.domElement.removeEventListener("dblclick", handleDoubleClick);
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [camera, controlsRef, gl.domElement, pointer, raycaster, sceneRef]);

  return null;
}

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("GLTF load error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <mesh>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="orange" />
          </mesh>
          <Html center>
            <div
              style={{
                color: "#fff",
                background: "rgba(15, 23, 42, 0.9)",
                padding: "12px 16px",
                borderRadius: "14px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                maxWidth: "320px",
                textAlign: "center"
              }}
            >
              <strong>Model load failed.</strong>
              <div style={{ marginTop: "8px", fontSize: "0.95rem" }}>
                Check the browser console for the GLTF error and confirm <code>/models/newschools.glb</code> is valid.
              </div>
            </div>
          </Html>
        </>
      );
    }

    return this.props.children;
  }
}

function isActiveVisitorWithLocation(visitor) {
  const status = (visitor.status || "").toString().toLowerCase();
  const hasScanSignal = Boolean(visitor.lastSeen || visitor.currentLocation || visitor.location);

  return status === "active" && hasScanSignal;
}

export default function MapView() {
  // Pangunahing component para sa 3D view page.
  const [visitorMarkers, setVisitorMarkers] = useState([]);
  const [cameraState, setCameraState] = useState(DEFAULT_CAMERA_STATE);
  const [showDashboard, setShowDashboard] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userSubRole, setUserSubRole] = useState(null);
  const modelUrl = BASE_MODEL_URL_WITH_CACHE_BUST;
  const [portalElement, setPortalElement] = useState(null);
  const sceneRef = useRef();
  const controlsRef = useRef();
  const canvasWrapperRef = useRef();
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const previousVisitorsRef = useRef({});

  const isSecurityUser = userRole === "security";
  const isAuthorizedUser = userRole === "authorized";
  const showLabels = isAuthorizedUser || (isSecurityUser && !showDashboard);
  const showMarkers = isAuthorizedUser || (isSecurityUser && !showDashboard);

  useEffect(() => {
    if (canvasWrapperRef.current) {
      setPortalElement(canvasWrapperRef.current);
    }

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      const savedState = loadSavedCameraState();
      setCameraState(savedState || DEFAULT_CAMERA_STATE);

      if (user?.email) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.email));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role || null);
            setUserSubRole(userData.subRole || null);
          } else {
            setUserRole(null);
            setUserSubRole(null);
          }
        } catch {
          setUserRole(null);
          setUserSubRole(null);
        }
      } else {
        setUserRole(null);
        setUserSubRole(null);
        setCameraState(DEFAULT_CAMERA_STATE);
        clearCameraState();
      }
    });

    function handleLogout(event) {
      const logoutUid = event?.detail?.uid || auth.currentUser?.uid || null;
      setCameraState(DEFAULT_CAMERA_STATE);
      clearCameraState(logoutUid);

      if (controlsRef.current) {
        controlsRef.current.object.position.set(...DEFAULT_CAMERA_STATE.position);
        controlsRef.current.target.set(...DEFAULT_CAMERA_STATE.target);
        controlsRef.current.update();
      }
    }

    window.addEventListener("trackvis-logout", handleLogout);

    return () => {
      unsubscribeAuth();
      window.removeEventListener("trackvis-logout", handleLogout);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const visitorList = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      const activeVisitors = visitorList.filter(isActiveVisitorWithLocation);

      Object.keys(previousVisitorsRef.current).forEach((id) => {
        if (!visitorList.find((x) => x.id === id)) {
          delete previousVisitorsRef.current[id];
        }
      });

      visitorList.forEach((v) => {
        previousVisitorsRef.current[v.id] = v;
      });

      setVisitorMarkers(activeVisitors);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setIsModelLoaded(false), 0);
    return () => clearTimeout(t);
  }, [modelUrl]);

  const handleResetClick = () => {
    const resetState = { ...DEFAULT_CAMERA_STATE };
    setCameraState(resetState);
    saveCameraState(resetState);

    if (controlsRef.current) {
      controlsRef.current.object.position.set(...resetState.position);
      controlsRef.current.target.set(...resetState.target);
      controlsRef.current.update();
    }
  };

  const handleDashboardToggle = () => {
    setShowDashboard((current) => !current);
  };

  const visibleVisitors = useMemo(() => {
    if (isAuthorizedUser) {
      if (!userSubRole) {
        return [];
      }

      return visitorMarkers.filter((visitor) => {
        return (visitor.destination || "").toString().toLowerCase() === userSubRole.toString().toLowerCase();
      });
    }

    return visitorMarkers;
  }, [visitorMarkers, isAuthorizedUser, userSubRole]);

  const markersByLocation = useMemo(() => {
    const grouped = {
      office: [],
      library: [],
      entrance: []
    };

    visibleVisitors.forEach((visitor) => {
      const key = getVisitorLocationKey(visitor);
      grouped[key].push(visitor);
    });

    return grouped;
  }, [visibleVisitors]);

  return (
    <div>
      <div ref={canvasWrapperRef} style={{ position: "relative", width: "100%", minHeight: "90vh", height: "90vh", borderRadius: 28, overflow: "hidden", background: "#0b1220" }}>
        {(isSecurityUser || isAuthorizedUser) && (
          <div style={{ position: "absolute", bottom: 18, right: 18, zIndex: 100020, display: "flex", flexDirection: "column", gap: 14, pointerEvents: "auto" }}>
            {isSecurityUser && (
              <button
                type="button"
                onClick={handleDashboardToggle}
                style={{
                  background: showDashboard ? "rgba(37, 99, 235, 0.95)" : "rgba(102, 126, 234, 0.95)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 600,
                  boxShadow: "0 10px 18px rgba(15, 23, 42, 0.22)",
                  minWidth: 160,
                  width: 160,
                  textAlign: "center"
                }}
              >
                {showDashboard ? "Hide Dashboard" : "Dashboard"}
              </button>
            )}
            <button
              type="button"
              onClick={handleResetClick}
              style={{
                background: "rgba(37, 99, 235, 0.95)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 600,
                boxShadow: "0 10px 18px rgba(37, 99, 235, 0.2)",
                minWidth: 160,
                width: 160,
                textAlign: "center"
              }}
            >
              Default Position
            </button>
          </div>
        )}
        <MemoizedMapScene
          cameraState={cameraState}
          modelUrl={modelUrl}
          markersByLocation={markersByLocation}
          sceneRef={sceneRef}
          controlsRef={controlsRef}
          showLabels={showLabels}
          showMarkers={showMarkers}
          portal={portalElement}
          setModelLoaded={setIsModelLoaded}
        />
        {/* Loading overlay renders while model isn't ready */}
        {!isModelLoaded && <LoadingOverlay />}

        {showDashboard && isSecurityUser && (
          <div
            className="overlay-dashboard"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 28,
              pointerEvents: "none",
              zIndex: 100005,
              display: "grid",
              placeItems: "center"
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "rgba(8, 13, 24, 0.94)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                borderRadius: 28,
                boxShadow: "0 28px 80px rgba(0,0,0,0.5)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                pointerEvents: "auto",
                backdropFilter: "blur(10px)"
              }}
            >
              <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.18em" }}>
                    Dashboard
                  </p>
                  <h2 style={{ margin: "6px 0 0", color: "#f8fafc", fontSize: "1.6rem" }}>
                    SCC 3D Dashboard
                  </h2>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "22px 22px 24px" }}>
                {userRole === "authorized" ? <AuthorizedDashboard /> : <SecurityDashboard />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

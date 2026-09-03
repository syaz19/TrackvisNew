// MapView.jsx
// Layunin: Pinapakita ang SCC 3D campus model at visitor marker UI.
// - Naglo-load ng /models/newschools.glb sa canvas.
// - Nagpapakita ng visitor markers mula sa Firestore.
// - May loading overlay at office scan alert.
// Ang page na ito ay parang digital map ng school, kung saan nakikita ang mga visitor sa 3D campus.

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
import RegisterVisitor from "./security/RegisterVisitor";

// mga kulay na ginagamit para sa visitor markers.
const markerColors = ["#ef4444", "#f59e0b", "#818CF8", "#22c55e", "#4F46E5"];
// base URL ng 3D model asset.
const BASE_MODEL_URL = `${import.meta.env.BASE_URL}models/newschools.glb`;
// cache-busted URL para iwas cache stale model.
const BASE_MODEL_URL_WITH_CACHE_BUST = `${BASE_MODEL_URL}?v=${Date.now()}`;
// preload ng GLTF model bago mag-render para mas mabilis.
useGLTF.preload(BASE_MODEL_URL_WITH_CACHE_BUST);

function LoadingOverlay() {
  // LoadingOverlay:
  // Ito ang overlay na lalabas habang hindi pa fully loaded ang 3D school model.
  // Ginagawa ito para alam ng user na may process pa sa background.
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
  position: [-97, 24, -50],
  target: [0, 0, 0],
  zoomDistance: 120
};

function getCameraStorageKey() {
  // getCameraStorageKey:
  // Ginagamit ito para magkaroon ng unique key sa camera state base sa logged-in user.
  // Kaya ang camera position ay memory per user at hindi magkakalituhan.
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
  // loadSavedCameraState:
  // Binabasa ang camera position na na-save dati upang ma-restore ang view.
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
  // saveCameraState:
  // Ini-save ang current camera view so pagbalik ng user, hindi na siya kailangan ulitin.
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
      if (currentUser && currentUser.uid) {
        keysToClear.push(`${CAMERA_STORAGE_BASE_KEY}-${currentUser.uid}`);
      }
    }

    keysToClear.forEach(function (key) {
      window.sessionStorage.removeItem(key);
    });
  } catch {
    // ignore remove failures
  }
}

function getVisitorLocationKey(visitor) {
  // getVisitorLocationKey:
  // Tinutukoy kung nasa office, library, o entrance ang visitor base sa current location field.
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
        className="trackvis-map-part-label"
        style={{
          padding: "14px 22px",
          borderRadius: "999px",
          background: "rgba(15, 23, 42, 0.98)",
          color: "#f8fafc",
          border: "1px solid rgba(129, 140, 248, 0.45)",
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
  // literal map pin icon at label para sa bawat visitor sa 3D model.
  const anchor = getLocationAnchor(locationKey);
  const radius = groupIndex === 0 ? 0 : 1.05;
  const angle = groupIndex * Math.PI * 0.75;
  const position = [
    anchor.position[0] + (groupIndex === 0 ? 0 : Math.cos(angle) * radius),
    anchor.position[1],
    anchor.position[2] + (groupIndex === 0 ? 0 : Math.sin(angle) * radius)
  ];
  const isOfficeLocation = locationKey === "office";
  const pinColor = markerColors[groupIndex % markerColors.length];

  return (
    <group>
      <Html portal={portal} position={[position[0], position[1] + 0.95, position[2]]} center style={{ pointerEvents: "none", zIndex: 0 }}>
        <div className="trackvis-visitor-marker" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <div
            className={isOfficeLocation ? "trackvis-office-visitor-label" : "trackvis-default-visitor-label"}
            style={{
              padding: "6px 10px",
              borderRadius: "999px",
              fontSize: "12px",
              whiteSpace: "nowrap",
              lineHeight: 1.2,
              zIndex: 0,
              transform: "none",
              transformOrigin: "center center"
            }}
          >
            {visitor.name || visitor.id}
          </div>
          <svg
            viewBox="0 0 64 80"
            aria-hidden="true"
            style={{
              width: "26px",
              height: "34px",
              display: "block",
              filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.28))",
              transform: "none",
              transformOrigin: "center center"
            }}
          >
            <path d="M32 4C17.64 4 6 15.64 6 30c0 18.2 17.82 29.12 24.34 39.6a2.5 2.5 0 0 0 3.32 0C40.18 59.12 58 48.2 58 30 58 15.64 46.36 4 32 4Z" fill={pinColor} />
            <circle cx="32" cy="30" r="10" fill="#FFFFFF" />
          </svg>
        </div>
      </Html>
    </group>
  );
}

function SchoolModel({ sceneRef, modelUrl, setModelLoaded }) {
  // Naglo-load ng GLTF model at inaayos ang mesh shadow properties.
  const { scene } = useGLTF(modelUrl);

  useEffect(function () {
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
  const [showRegister, setShowRegister] = useState(false);
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
  const showLabels = isAuthorizedUser || (isSecurityUser && !showRegister);
  const showMarkers = isAuthorizedUser || (isSecurityUser && !showRegister);

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

    return function () {
      unsubscribeAuth();
      window.removeEventListener("trackvis-logout", handleLogout);
    };
  }, []);

  useEffect(function () {
    const unsubscribe = onSnapshot(collection(db, "visitors"), function (snapshot) {
      const visitorList = snapshot.docs.map(function (item) {
        return { id: item.id, ...item.data() };
      });
      const activeVisitors = visitorList.filter(isActiveVisitorWithLocation);

      Object.keys(previousVisitorsRef.current).forEach(function (id) {
        if (!visitorList.find(function (visitor) { return visitor.id === id; })) {
          delete previousVisitorsRef.current[id];
        }
      });

      visitorList.forEach(function (visitor) {
        previousVisitorsRef.current[visitor.id] = visitor;
      });

      setVisitorMarkers(activeVisitors);
    });

    return function () {
      unsubscribe();
    };
  }, []);

  useEffect(function () {
    const timeout = setTimeout(function () {
      setIsModelLoaded(false);
    }, 0);
    return function () {
      clearTimeout(timeout);
    };
  }, [modelUrl]);

  function handleResetClick() {
    const resetState = { ...DEFAULT_CAMERA_STATE };
    setCameraState(resetState);
    saveCameraState(resetState);

    if (controlsRef.current) {
      controlsRef.current.object.position.set(...resetState.position);
      controlsRef.current.target.set(...resetState.target);
      controlsRef.current.update();
    }
  }

  function handleRegisterToggle() {
    setShowRegister(function (current) {
      return !current;
    });
  }

  const visibleVisitors = useMemo(() => {
    if (isAuthorizedUser) {
      if (!userSubRole) {
        return [];
      }

      return visitorMarkers.filter((visitor) => {
        const destinations = Array.isArray(visitor.destinations)
          ? visitor.destinations
          : (visitor.destination || "").toString().split(",").map((destination) => destination.trim()).filter(Boolean);
        return destinations.some((destination) => destination.toLowerCase() === userSubRole.toString().toLowerCase());
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
    <div className="map-view-shell">
      <div className="map-canvas-shell" ref={canvasWrapperRef} style={{ position: "relative", width: "100%", minHeight: "90vh", height: "90vh", borderRadius: 28, overflow: "hidden", background: "#090D1A" }}>
        {(isSecurityUser || isAuthorizedUser) && (
          <div className="map-action-controls" style={{ position: "absolute", bottom: 18, right: 18, zIndex: 100020, display: "flex", flexDirection: "column", gap: 14, pointerEvents: "auto" }}>
            {isSecurityUser && (
              <button
                type="button"
                onClick={handleRegisterToggle}
                style={{
                  background: showRegister ? "rgba(67, 56, 202, 0.95)" : "rgba(79, 70, 229, 0.95)",
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
                {showRegister ? "Hide Register" : "Register Visitor"}
              </button>
            )}
            <button
              type="button"
              onClick={handleResetClick}
              style={{
                background: "rgba(79, 70, 229, 0.95)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 600,
                boxShadow: "0 10px 18px rgba(79, 70, 229, 0.2)",
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

        {showRegister && isSecurityUser && (
          <div
            className="overlay-register"
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
              <div className="register-form-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 20px 24px" }}>
                <RegisterVisitor />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

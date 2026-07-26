import { Suspense, Component, useEffect, useState, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Html } from "@react-three/drei";
import * as THREE from "three";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const markerColors = ["#ef4444", "#f59e0b", "#38bdf8", "#22c55e", "#a855f7"];
const CAMERA_STORAGE_BASE_KEY = "trackvis-school-3d-camera";
const DEFAULT_CAMERA_STATE = {
  position: [0, 40, -115],
  target: [0, 0, 0],
  zoomDistance: 130
};

function getCameraStorageKey() {
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

function VisitorMarker({ visitor, index }) {
  // Gumagawa ng marker para sa bawat active visitor sa 3D scene.
  const basePosition = [-6.8, 1.5, 0];
  const offset = index * 0.7;
  const depthOffset = index * 0.35;
  const position = [basePosition[0] + offset, basePosition[1], basePosition[2] + depthOffset];
  const color = markerColors[index % markerColors.length];

  return (
    <group>
      <mesh position={position}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[position[0], position[1] + 0.5, position[2]]} center>
        <div
          style={{
            background: "rgba(15, 23, 42, 0.9)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "999px",
            fontSize: "11px",
            whiteSpace: "nowrap",
            border: "1px solid rgba(255, 255, 255, 0.15)"
          }}
        >
          {visitor.name || visitor.id}
        </div>
      </Html>
    </group>
  );
}

function SchoolModel({ sceneRef }) {
  // Naglo-load ng 3D model sa public/models folder.
  const modelUrl = `${import.meta.env.BASE_URL}models/schools.glb`;
  useGLTF.preload(modelUrl);
  const { scene } = useGLTF(modelUrl);

  useEffect(() => {
    scene.traverse(function (child) {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive ref={sceneRef} object={scene} dispose={null} scale={0.18} position={[0, -1.1, 0]} />;
}

function DoubleClickZoom({ sceneRef, controlsRef }) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
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
      const distance = Math.max(4, camera.position.distanceTo(hitPoint) * 0.5);
      const endPosition = hitPoint.clone().add(viewDirection.multiplyScalar(-distance));
      const startPosition = camera.position.clone();
      const startTarget = controlsRef.current.target.clone();

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      animateCamera(startPosition, startTarget, endPosition, hitPoint, () => {
        saveCameraState({
          position: [endPosition.x, endPosition.y, endPosition.z],
          target: [hitPoint.x, hitPoint.y, hitPoint.z],
          zoomDistance: distance
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

function CameraControls({ controlsRef, initialState }) {
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
                Check the browser console for the GLTF error and confirm <code>/models/schools.glb</code> is valid.
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
  const [visitorMarkers, setVisitorMarkers] = useState([]);
  const [cameraState, setCameraState] = useState(DEFAULT_CAMERA_STATE);
  const sceneRef = useRef();
  const controlsRef = useRef();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(() => {
      const savedState = loadSavedCameraState();
      setCameraState(savedState || DEFAULT_CAMERA_STATE);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const visitorList = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      const activeVisitors = visitorList.filter(isActiveVisitorWithLocation);
      setVisitorMarkers(activeVisitors);
    });

    return () => unsubscribe();
  }, []);

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

  return (
    <div>
      <div style={{ position: "relative", width: "100%", minHeight: "90vh", height: "90vh", borderRadius: 28, overflow: "hidden", background: "#0b1220" }}>
        <button
          type="button"
          onClick={handleResetClick}
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            zIndex: 3,
            background: "rgba(37, 99, 235, 0.95)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            cursor: "pointer",
            fontWeight: 600,
            boxShadow: "0 10px 18px rgba(37, 99, 235, 0.2)",
            minWidth: 150
          }}
        >
          Back to Normal Position
        </button>
        <Canvas style={{ width: "100%", height: "100%" }} shadows camera={{ position: cameraState.position, fov: 35, near: 0.1, far: 1000 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
          <ModelErrorBoundary>
            <Suspense
              fallback={
                <mesh>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="#334155" />
                </mesh>
              }
            >
              <SchoolModel sceneRef={sceneRef} />
              {visitorMarkers.map((visitor, index) => (
                <VisitorMarker key={visitor.id || `${visitor.uid}-${index}`} visitor={visitor} index={index} />
              ))}
              <Environment preset="city" />
            </Suspense>
          </ModelErrorBoundary>
          <CameraControls controlsRef={controlsRef} initialState={cameraState} />
          <DoubleClickZoom sceneRef={sceneRef} controlsRef={controlsRef} />
        </Canvas>
      </div>
    </div>
  );
}

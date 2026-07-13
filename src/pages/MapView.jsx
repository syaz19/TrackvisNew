import { Suspense, Component, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Html } from "@react-three/drei";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const markerColors = ["#ef4444", "#f59e0b", "#38bdf8", "#22c55e", "#a855f7"];

function VisitorMarker({ visitor, index }) {
  const basePosition = [-6.5, 1.5, 0];
  const position = [basePosition[0] + index * 0.7, basePosition[1], basePosition[2] + index * 0.35];
  const color = markerColors[index % markerColors.length];

  return (
    <group>
      <mesh position={position}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[position[0], position[1] + 0.5, position[2]]} center>
        <div style={{
          background: "rgba(15, 23, 42, 0.9)",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: "999px",
          fontSize: "11px",
          whiteSpace: "nowrap",
          border: "1px solid rgba(255, 255, 255, 0.15)"
        }}>
          {visitor.name || visitor.id}
        </div>
      </Html>
    </group>
  );
}

function SchoolModel() {
  const modelUrl = `${import.meta.env.BASE_URL}models/schools.glb`;
  const { scene } = useGLTF(modelUrl);

  scene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return <primitive object={scene} dispose={null} scale={0.18} position={[0, -1.1, 0]} />;
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
            <div style={{
              color: "#fff",
              background: "rgba(15, 23, 42, 0.9)",
              padding: "12px 16px",
              borderRadius: "14px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              maxWidth: "320px",
              textAlign: "center"
            }}>
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

export default function MapView() {
  const [visitorMarkers, setVisitorMarkers] = useState([]);
  const [showEnvironment, setShowEnvironment] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "visitors"), (snapshot) => {
      const activeVisitors = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((visitor) => {
          const status = (visitor.status || "").toString().toLowerCase();
          const hasScanSignal = Boolean(
            visitor.lastSeen ||
            visitor.currentLocation ||
            visitor.location
          );
          return status === "active" && hasScanSignal;
        });

      setVisitorMarkers(activeVisitors);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowEnvironment(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div>
      <h1>Campus 3D Map / Model</h1>
      <div style={{ width: "100%", height: "640px", borderRadius: 16, overflow: "hidden", background: "#0b1220" }}>
        <Canvas shadows camera={{ position: [0, 2.2, 12], fov: 35 }}>
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
              <SchoolModel />
              {visitorMarkers.map((visitor, index) => (
                <VisitorMarker key={visitor.id || `${visitor.uid}-${index}`} visitor={visitor} index={index} />
              ))}
              {showEnvironment && <Environment preset="city" />}
            </Suspense>
          </ModelErrorBoundary>
          <OrbitControls enablePan enableZoom enableRotate />
        </Canvas>
      </div>
    </div>
  );
}

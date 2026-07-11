import { Suspense, Component } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import {  OrbitControls, useGLTF, Environment, Html } from "@react-three/drei";

function SchoolModel() {
  const modelUrl = `${import.meta.env.BASE_URL}models/schools.glb`;
  const { scene } = useGLTF(modelUrl);

  scene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return <primitive object={scene} dispose={null} scale={0.1} position={[0, -1.2, 0]} />;
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
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <div>
      <h1>Campus 3D Map / Model</h1>
      <div style={{ width: "100%", height: "520px", borderRadius: 16, overflow: "hidden", background: "#0b1220" }}>
        <Canvas shadows camera={{ position: [5, 4, 12], fov: 45 }}>
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
              <Environment preset="city" />
            </Suspense>
          </ModelErrorBoundary>
          <OrbitControls enablePan enableZoom enableRotate />
        </Canvas>
      </div>
      
      <button
        onClick={handleBack}
        className="btn-outline"
        style={{
          marginTop: 12,
          display: "inline-block",
          padding: "10px 16px",
          background: "transparent",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          borderRadius: "14px",
          color: "#e5e7eb",
          cursor: "pointer",
          fontWeight: "600"
        }}
      >
        Back
      </button>
    </div>
  );
}

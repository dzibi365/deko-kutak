import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress, Html } from "@react-three/drei";
import * as THREE from "three";
import { MousePointer2 } from "lucide-react";

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ color: "white", fontSize: "12px", textAlign: "center" }}>
        <div style={{
          width: "28px", height: "28px",
          border: "2px solid rgba(255,255,255,0.2)",
          borderTop: "2px solid white",
          borderRadius: "50%",
          animation: "spin3d 0.8s linear infinite",
          margin: "0 auto 6px",
        }} />
        {Math.round(progress)}%
      </div>
    </Html>
  );
}

const COPPER = new THREE.Color("#b87333");
const HOVER_COLOR = new THREE.Color("#c8bfb0");

function PickerModel({
  modelUrl,
  selectedMesh,
  onSelect,
}: {
  modelUrl: string;
  selectedMesh: string;
  onSelect: (name: string) => void;
}) {
  const { scene } = useGLTF(modelUrl);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const [hovered, setHovered] = useState<string | null>(null);

  // Store original materials once
  useEffect(() => {
    cloned.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.userData.origMat = mesh.material;
    });
  }, [cloned]);

  // Apply highlight materials whenever selection/hover changes
  useEffect(() => {
    cloned.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.userData.origMat) return;

      if (mesh.name === selectedMesh) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: COPPER,
          emissive: COPPER,
          emissiveIntensity: 0.35,
          roughness: 0.3,
          metalness: 0.1,
        });
      } else if (mesh.name === hovered) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: HOVER_COLOR,
          emissive: HOVER_COLOR,
          emissiveIntensity: 0.2,
          roughness: 0.4,
        });
      } else {
        mesh.material = mesh.userData.origMat;
      }
    });
  }, [cloned, selectedMesh, hovered]);

  return (
    <primitive
      object={cloned}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const name = e.object?.name;
        if (name) onSelect(name);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const name = e.object?.name;
        if (name) { setHovered(name); document.body.style.cursor = "pointer"; }
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = "auto";
      }}
    />
  );
}

type Props = {
  modelUrl: string;
  selectedMesh: string;
  onSelect: (name: string) => void;
};

export function MeshPickerCanvas({ modelUrl, selectedMesh, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full h-52 rounded-xl overflow-hidden bg-[#111] border border-gray-200 relative">
        <style>{`@keyframes spin3d { to { transform: rotate(360deg); } }`}</style>

        {/* Instruction overlay — only when nothing selected */}
        {!selectedMesh && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/50 rounded-lg pointer-events-none">
            <MousePointer2 className="w-3 h-3 text-white/60" strokeWidth={1.5} />
            <span className="text-[11px] text-white/60">Click a surface to select it</span>
          </div>
        )}

        <Canvas camera={{ position: [0, 0, 3], fov: 45 }} gl={{ antialias: true }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 5, 4]} intensity={1.4} />
          <directionalLight position={[-3, 2, -3]} intensity={0.4} />

          <Suspense fallback={<Loader />}>
            <PickerModel
              modelUrl={modelUrl}
              selectedMesh={selectedMesh}
              onSelect={onSelect}
            />
          </Suspense>

          <OrbitControls
            enablePan={false}
            autoRotate={!selectedMesh}
            autoRotateSpeed={1.2}
            minDistance={0.5}
            maxDistance={8}
          />
        </Canvas>
      </div>

      {/* Status chip */}
      {selectedMesh ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
          <p className="text-xs text-navy flex-1">
            Photo surface: <span className="font-mono font-semibold text-amber-700">{selectedMesh}</span>
          </p>
          <button
            type="button"
            onClick={() => onSelect("")}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center">
          Drag to rotate · Click any surface to mark it as the photo area
        </p>
      )}
    </div>
  );
}

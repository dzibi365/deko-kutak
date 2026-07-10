import { Suspense, useMemo, useEffect, useState } from "react";
import { X, RotateCcw, AlertTriangle } from "lucide-react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress, Html } from "@react-three/drei";
import * as THREE from "three";

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ color: "white", fontSize: "14px", textAlign: "center" }}>
        <div
          style={{
            width: "40px", height: "40px",
            border: "3px solid rgba(255,255,255,0.2)",
            borderTop: "3px solid white",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 8px",
          }}
        />
        Loading model… {Math.round(progress)}%
      </div>
    </Html>
  );
}

type ModelProps = {
  modelUrl: string;
  textureUrl: string;
  meshName: string;
  onStatus: (status: "ok" | "mesh_not_found" | "tex_error", meshNames?: string[]) => void;
};

function Model({ modelUrl, textureUrl, meshName, onStatus }: ModelProps) {
  const { scene } = useGLTF(modelUrl);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!textureUrl || !meshName) return;

    // Collect all mesh names from the model for diagnostics
    const allMeshNames: string[] = [];
    cloned.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) allMeshNames.push(node.name);
    });
    console.log("[3D Preview] Meshes in model:", allMeshNames);
    console.log("[3D Preview] Looking for mesh:", meshName);

    // Case-insensitive match as fallback
    const targetName = meshName.trim();
    const exactMatch = allMeshNames.find((n) => n === targetName);
    const looseMatch = allMeshNames.find((n) => n.toLowerCase() === targetName.toLowerCase());
    const resolvedName = exactMatch ?? looseMatch ?? null;

    if (!resolvedName) {
      console.warn("[3D Preview] Mesh not found. Available meshes:", allMeshNames);
      onStatus("mesh_not_found", allMeshNames);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(
      textureUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        // Try both flipY values — false is correct for GLTF UV convention
        texture.flipY = false;
        texture.needsUpdate = true;

        cloned.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.isMesh && mesh.name === resolvedName) {
            mesh.material = new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.5,
              metalness: 0.05,
            });
            console.log("[3D Preview] Texture applied to mesh:", resolvedName);
          }
        });
        onStatus("ok");
      },
      undefined,
      (err) => {
        console.error("[3D Preview] Texture load error:", err);
        onStatus("tex_error");
      }
    );
  }, [cloned, textureUrl, meshName, onStatus]);

  return <primitive object={cloned} />;
}

function CameraResetter() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 2.5);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

type Props = {
  modelUrl: string;
  textureUrl: string;
  meshName: string;
  onClose: () => void;
};

export function ThreeDPreviewModal({ modelUrl, textureUrl, meshName, onClose }: Props) {
  const [status, setStatus] = useState<"loading" | "ok" | "mesh_not_found" | "tex_error">("loading");
  const [availableMeshes, setAvailableMeshes] = useState<string[]>([]);

  function handleStatus(s: "ok" | "mesh_not_found" | "tex_error", names?: string[]) {
    setStatus(s);
    if (names) setAvailableMeshes(names);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div>
          <p className="font-semibold text-white text-base">3D Preview</p>
          <p className="text-xs text-white/40 mt-0.5">Drag to rotate · Scroll to zoom</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent("reset3dcamera")); }}
            className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            title="Reset view"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Warning banner */}
      {status === "mesh_not_found" && (
        <div className="mx-5 mb-2 flex flex-col gap-1 px-4 py-3 bg-amber-500/20 border border-amber-500/40 rounded-xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" strokeWidth={1.75} />
            <p className="text-sm text-amber-300 font-medium">
              Mesh "{meshName}" not found in this model.
            </p>
          </div>
          {availableMeshes.length > 0 && (
            <p className="text-xs text-amber-400/70 pl-6">
              Available meshes: <span className="font-mono">{availableMeshes.join(", ")}</span>
            </p>
          )}
          <p className="text-xs text-amber-400/50 pl-6">Update the mesh name in the admin product settings.</p>
        </div>
      )}

      {status === "tex_error" && (
        <div className="mx-5 mb-2 flex items-center gap-2 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-xl flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" strokeWidth={1.75} />
          <p className="text-sm text-red-300">Could not load the uploaded image as a texture. Check browser console for details.</p>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <Canvas
          camera={{ position: [0, 0, 2.5], fov: 45 }}
          gl={{ antialias: true }}
          shadows
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 6, 4]} intensity={1.6} castShadow />
          <directionalLight position={[-3, 2, -4]} intensity={0.5} />
          <pointLight position={[0, -3, 0]} intensity={0.2} />

          <Suspense fallback={<Loader />}>
            <Model
              modelUrl={modelUrl}
              textureUrl={textureUrl}
              meshName={meshName}
              onStatus={handleStatus}
            />
          </Suspense>

          <OrbitControls
            enablePan={false}
            minDistance={0.5}
            maxDistance={8}
            autoRotate
            autoRotateSpeed={1.2}
          />
          <CameraResetter />
        </Canvas>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 text-center py-3">
        <p className="text-xs text-white/20">Click outside to close</p>
      </div>
    </div>
  );
}

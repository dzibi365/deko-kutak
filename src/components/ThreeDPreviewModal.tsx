import { Suspense, useMemo, useEffect, useState, useCallback } from "react";
import { X, RotateCcw, AlertTriangle } from "lucide-react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress, Html } from "@react-three/drei";
import * as THREE from "three";

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ color: "white", fontSize: "14px", textAlign: "center" }}>
        <div style={{
          width: "40px", height: "40px",
          border: "3px solid rgba(255,255,255,0.2)",
          borderTop: "3px solid white",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 8px",
        }} />
        Loading model… {Math.round(progress)}%
      </div>
    </Html>
  );
}

type ModelProps = {
  modelUrl: string;
  textureUrl: string;
  meshName: string;
  onStatus: (s: "ok" | "mesh_not_found" | "tex_error", names?: string[]) => void;
};

function Model({ modelUrl, textureUrl, meshName, onStatus }: ModelProps) {
  const { scene } = useGLTF(modelUrl);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!textureUrl || !meshName) return;
    let active = true;

    const allNames: string[] = [];
    cloned.traverse((n) => { if ((n as THREE.Mesh).isMesh) allNames.push(n.name); });
    console.log("[3D] All meshes in model:", allNames);
    console.log("[3D] Looking for mesh:", meshName);
    console.log("[3D] Texture URL:", textureUrl);

    let target: THREE.Mesh | null = null;
    cloned.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh && !target) {
        if (m.name === meshName || m.name.toLowerCase() === meshName.toLowerCase()) target = m;
      }
    });

    if (!target) {
      console.warn("[3D Preview] Mesh not found. Available:", allNames);
      onStatus("mesh_not_found", allNames);
      return;
    }

    const uvAttrCheck = (target as THREE.Mesh).geometry.getAttribute("uv");
    console.log("[3D] Target mesh found:", (target as THREE.Mesh).name,
      "| UV count:", uvAttrCheck?.count ?? "NO UV ATTRIBUTE",
      "| Visible:", (target as THREE.Mesh).visible,
      "| Parent:", (target as THREE.Mesh).parent?.name);

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(
      textureUrl,
      (texture) => {
        if (!active) return;
        console.log("[3D] Texture loaded! Size:", texture.image?.width, "×", texture.image?.height);

        // Remap geometry UVs to [0,1]×[0,1] so the full image covers the face
        const geom = (target as THREE.Mesh).geometry.clone();
        const uvAttr = geom.getAttribute("uv") as THREE.BufferAttribute | null;
        if (uvAttr && uvAttr.count > 0) {
          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (let i = 0; i < uvAttr.count; i++) {
            const u = uvAttr.getX(i), v = uvAttr.getY(i);
            if (u < minU) minU = u; if (u > maxU) maxU = u;
            if (v < minV) minV = v; if (v > maxV) maxV = v;
          }
          console.log("[3D] UV bounds:", { minU: minU.toFixed(3), maxU: maxU.toFixed(3), minV: minV.toFixed(3), maxV: maxV.toFixed(3) });
          if (maxU > minU && maxV > minV) {
            const rU = maxU - minU, rV = maxV - minV;
            for (let i = 0; i < uvAttr.count; i++) {
              uvAttr.setXY(i, (uvAttr.getX(i) - minU) / rU, (uvAttr.getY(i) - minV) / rV);
            }
            uvAttr.needsUpdate = true;
            console.log("[3D] UVs remapped to [0,1]×[0,1]");
          } else {
            console.warn("[3D] UV range degenerate — cannot remap");
          }
        } else {
          console.warn("[3D] No UV attribute found on target mesh!");
        }
        // Always assign cloned geometry (whether UVs were remapped or not)
        (target as THREE.Mesh).geometry = geom;

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.needsUpdate = true;
        // MeshBasicMaterial ignores lighting — shows texture as-is regardless of face normals
        const mat = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });
        (target as THREE.Mesh).material = mat;
        console.log("[3D] Material applied to mesh:", (target as THREE.Mesh).name);
        onStatus("ok");
      },
      undefined,
      (err) => { if (active) { console.error("[3D Preview] Texture FAILED to load:", err); onStatus("tex_error"); } }
    );

    return () => { active = false; };
  }, [cloned, textureUrl, meshName, onStatus]);

  return <primitive object={cloned} />;
}

function CameraResetter() {
  const { camera } = useThree();
  useEffect(() => { camera.position.set(0, 0, 2.5); camera.lookAt(0, 0, 0); }, [camera]);
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

  const handleStatus = useCallback((s: "ok" | "mesh_not_found" | "tex_error", names?: string[]) => {
    setStatus(s);
    if (names) setAvailableMeshes(names);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div>
          <p className="font-semibold text-white text-base">3D Preview</p>
          <p className="text-xs text-white/40 mt-0.5">Drag to rotate · Scroll to zoom</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { window.dispatchEvent(new CustomEvent("reset3dcamera")); }}
            className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors" title="Reset view">
            <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {status === "mesh_not_found" && (
        <div className="mx-5 mb-2 flex flex-col gap-1 px-4 py-3 bg-amber-500/20 border border-amber-500/40 rounded-xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" strokeWidth={1.75} />
            <p className="text-sm text-amber-300 font-medium">Mesh "{meshName}" not found in this model.</p>
          </div>
          {availableMeshes.length > 0 && (
            <p className="text-xs text-amber-400/70 pl-6">Available: <span className="font-mono">{availableMeshes.join(", ")}</span></p>
          )}
        </div>
      )}

      {status === "tex_error" && (
        <div className="mx-5 mb-2 flex items-center gap-2 px-4 py-3 bg-red-500/20 border border-red-500/40 rounded-xl flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" strokeWidth={1.75} />
          <p className="text-sm text-red-300">Could not load the uploaded image as a texture.</p>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <Canvas camera={{ position: [0, 0, 2.5], fov: 45 }} gl={{ antialias: true }} shadows>
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 6, 4]} intensity={1.6} castShadow />
          <directionalLight position={[-3, 2, -4]} intensity={0.5} />
          <pointLight position={[0, -3, 0]} intensity={0.2} />
          <Suspense fallback={<Loader />}>
            <Model modelUrl={modelUrl} textureUrl={textureUrl} meshName={meshName} onStatus={handleStatus} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={0.5} maxDistance={8} autoRotate autoRotateSpeed={1.2} />
          <CameraResetter />
        </Canvas>
      </div>

      <div className="flex-shrink-0 text-center py-3">
        <p className="text-xs text-white/20">Click outside to close</p>
      </div>
    </div>
  );
}

import { Suspense, useMemo, useEffect, useState, useCallback } from "react";
import { X, RotateCcw, AlertTriangle, Palette } from "lucide-react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress, Html } from "@react-three/drei";
import * as THREE from "three";

const PRESET_COLORS = [
  { hex: "#ffffff", label: "White" },
  { hex: "#f5efe6", label: "Cream" },
  { hex: "#d4b896", label: "Caramel" },
  { hex: "#a8b89a", label: "Sage" },
  { hex: "#5c7a5c", label: "Forest" },
  { hex: "#2d4a7a", label: "Navy" },
  { hex: "#8b2c3a", label: "Burgundy" },
  { hex: "#2a2a2a", label: "Charcoal" },
];

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
  color: string;
  onStatus: (s: "ok" | "mesh_not_found" | "tex_error", names?: string[]) => void;
};

function Model({ modelUrl, textureUrl, meshName, color, onStatus }: ModelProps) {
  const { scene } = useGLTF(modelUrl);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // Apply color to all meshes except the photo face
  useEffect(() => {
    cloned.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh && m.name.toLowerCase() !== meshName.toLowerCase()) {
        m.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness: 0.6,
          metalness: 0.0,
        });
      }
    });
  }, [cloned, color, meshName]);

  // Apply customer photo to the selected mesh
  useEffect(() => {
    if (!textureUrl || !meshName) return;
    let active = true;

    const allNames: string[] = [];
    cloned.traverse((n) => { if ((n as THREE.Mesh).isMesh) allNames.push(n.name); });

    let target: THREE.Mesh | null = null;
    cloned.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh && !target) {
        if (m.name === meshName || m.name.toLowerCase() === meshName.toLowerCase()) target = m;
      }
    });

    if (!target) {
      onStatus("mesh_not_found", allNames);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(
      textureUrl,
      (texture) => {
        if (!active) return;

        const geom = (target as THREE.Mesh).geometry.clone();
        const existingUv = geom.getAttribute("uv") as THREE.BufferAttribute | null;

        if (existingUv && existingUv.count > 0) {
          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (let i = 0; i < existingUv.count; i++) {
            const u = existingUv.getX(i), v = existingUv.getY(i);
            if (u < minU) minU = u; if (u > maxU) maxU = u;
            if (v < minV) minV = v; if (v > maxV) maxV = v;
          }
          if (maxU > minU && maxV > minV) {
            const rU = maxU - minU, rV = maxV - minV;
            for (let i = 0; i < existingUv.count; i++) {
              existingUv.setXY(i, (existingUv.getX(i) - minU) / rU, (existingUv.getY(i) - minV) / rV);
            }
            existingUv.needsUpdate = true;
          }
        } else {
          // No UV attribute — generate planar UVs from vertex positions
          const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
          const normalAttr = geom.getAttribute("normal") as THREE.BufferAttribute | null;

          let uAxis = 0, vAxis = 2;
          if (normalAttr && normalAttr.count > 0) {
            let sumX = 0, sumY = 0, sumZ = 0;
            for (let i = 0; i < normalAttr.count; i++) {
              sumX += Math.abs(normalAttr.getX(i));
              sumY += Math.abs(normalAttr.getY(i));
              sumZ += Math.abs(normalAttr.getZ(i));
            }
            if (sumX >= sumY && sumX >= sumZ) { uAxis = 1; vAxis = 2; }
            else if (sumZ >= sumX && sumZ >= sumY) { uAxis = 0; vAxis = 1; }
          }

          const comp = (i: number, axis: number) =>
            axis === 0 ? posAttr.getX(i) : axis === 1 ? posAttr.getY(i) : posAttr.getZ(i);

          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (let i = 0; i < posAttr.count; i++) {
            const u = comp(i, uAxis), v = comp(i, vAxis);
            if (u < minU) minU = u; if (u > maxU) maxU = u;
            if (v < minV) minV = v; if (v > maxV) maxV = v;
          }
          const rU = maxU - minU || 1, rV = maxV - minV || 1;
          const uvData = new Float32Array(posAttr.count * 2);
          for (let i = 0; i < posAttr.count; i++) {
            uvData[i * 2]     = (comp(i, uAxis) - minU) / rU;
            uvData[i * 2 + 1] = (comp(i, vAxis) - minV) / rV;
          }
          geom.setAttribute("uv", new THREE.BufferAttribute(uvData, 2));
        }

        (target as THREE.Mesh).geometry = geom;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.needsUpdate = true;
        const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        (target as THREE.Mesh).material = mat;
        onStatus("ok");
      },
      undefined,
      (err) => { if (active) { console.error("[3D Preview] Texture error:", err); onStatus("tex_error"); } }
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
  const [color, setColor] = useState("#ffffff");

  const handleStatus = useCallback((s: "ok" | "mesh_not_found" | "tex_error", names?: string[]) => {
    setStatus(s);
    if (names) setAvailableMeshes(names);
  }, []);

  const isCustomColor = !PRESET_COLORS.some((p) => p.hex === color);

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
            <Model
              modelUrl={modelUrl}
              textureUrl={textureUrl}
              meshName={meshName}
              color={color}
              onStatus={handleStatus}
            />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={0.5} maxDistance={8} autoRotate autoRotateSpeed={1.2} />
          <CameraResetter />
        </Canvas>
      </div>

      {/* Color picker */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-white/10 flex items-center gap-3">
        <Palette className="w-4 h-4 text-white/40 flex-shrink-0" strokeWidth={1.75} />
        <span className="text-xs text-white/40 flex-shrink-0">Color</span>
        <div className="flex items-center gap-1.5 flex-1">
          {PRESET_COLORS.map((p) => (
            <button
              key={p.hex}
              title={p.label}
              onClick={() => setColor(p.hex)}
              style={{ background: p.hex }}
              className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 ${
                color === p.hex
                  ? "border-white scale-110 shadow-lg"
                  : "border-white/20 hover:border-white/60 hover:scale-105"
              }`}
            />
          ))}
        </div>
        {/* Custom color picker */}
        <label
          title="Custom color"
          className={`w-6 h-6 rounded-full border-2 flex-shrink-0 cursor-pointer overflow-hidden transition-all ${
            isCustomColor ? "border-white scale-110" : "border-white/20 hover:border-white/60"
          }`}
          style={{ background: isCustomColor ? color : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        >
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="opacity-0 w-0 h-0 absolute"
          />
        </label>
      </div>
    </div>
  );
}

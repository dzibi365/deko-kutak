import { useEffect, useRef, useState } from "react";
import { Upload, Download, X, ImageIcon, Lock, Unlock } from "lucide-react";

type Format = "image/webp" | "image/jpeg" | "image/png";
type CropRect = { x: number; y: number; w: number; h: number };

const HANDLE_SIZE = 8;

const RATIO_PRESETS = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "3:4", value: 3 / 4 },
  { label: "2:3", value: 2 / 3 },
];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function hitHandle(px: number, hx: number, py: number, hy: number) {
  return Math.abs(px - hx) <= HANDLE_SIZE && Math.abs(py - hy) <= HANDLE_SIZE;
}

function centeredCrop(ratio: number, dw: number, dh: number): CropRect {
  const fill = 0.85;
  let w = dw * fill, h = w / ratio;
  if (h > dh * fill) { h = dh * fill; w = h * ratio; }
  return { x: Math.round((dw - w) / 2), y: Math.round((dh - h) / 2), w: Math.round(w), h: Math.round(h) };
}

export default function ImageTools() {
  const [src, setSrc] = useState<string | null>(null);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [fileName, setFileName] = useState("image");

  const [outW, setOutW] = useState(0);
  const [outH, setOutH] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);
  const [quality, setQuality] = useState(0.88);
  const [format, setFormat] = useState<Format>("image/webp");

  const [crop, setCrop] = useState<CropRect | null>(null);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [cropRatio, setCropRatio] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);
  const [cursor, setCursor] = useState("default");

  const drag = useRef<{
    type: "new" | "move" | "tl" | "tr" | "bl" | "br";
    startX: number; startY: number;
    origCrop?: CropRect;
  } | null>(null);

  function loadFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
      setOutW(img.naturalWidth);
      setOutH(img.naturalHeight);
      setSrc(url);
      setCrop(null);
      setCropEnabled(false);
      setCropRatio(null);
    };
    img.src = url;
    setFileName(file.name.replace(/\.[^.]+$/, ""));
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }

  useEffect(() => {
    if (!src || !containerRef.current || !naturalW) return;
    const maxW = containerRef.current.clientWidth;
    const maxH = Math.min(480, window.innerHeight * 0.55);
    const scale = Math.min(1, maxW / naturalW, maxH / naturalH);
    setDisplayW(Math.round(naturalW * scale));
    setDisplayH(Math.round(naturalH * scale));
  }, [src, naturalW, naturalH]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !displayW || !displayH) return;
    canvas.width = displayW;
    canvas.height = displayH;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.drawImage(img, 0, 0, displayW, displayH);

    if (cropEnabled && crop && crop.w > 2 && crop.h > 2) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, displayW, displayH);
      ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
      ctx.drawImage(img, 0, 0, displayW, displayH);

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.75;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(crop.x + (crop.w / 3) * i, crop.y); ctx.lineTo(crop.x + (crop.w / 3) * i, crop.y + crop.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(crop.x, crop.y + (crop.h / 3) * i); ctx.lineTo(crop.x + crop.w, crop.y + (crop.h / 3) * i); ctx.stroke();
      }

      [
        { x: crop.x, y: crop.y },
        { x: crop.x + crop.w, y: crop.y },
        { x: crop.x, y: crop.y + crop.h },
        { x: crop.x + crop.w, y: crop.y + crop.h },
      ].forEach(({ x, y }) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      });
    }
  }, [src, displayW, displayH, crop, cropEnabled]);

  function getXY(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: clamp(e.clientX - r.left, 0, displayW), y: clamp(e.clientY - r.top, 0, displayH) };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!cropEnabled) return;
    const { x, y } = getXY(e);
    if (crop && crop.w > 2 && crop.h > 2) {
      const { x: cx, y: cy, w, h } = crop;
      if (hitHandle(x, cx, y, cy))       { drag.current = { type: "tl", startX: x, startY: y, origCrop: { ...crop } }; return; }
      if (hitHandle(x, cx + w, y, cy))   { drag.current = { type: "tr", startX: x, startY: y, origCrop: { ...crop } }; return; }
      if (hitHandle(x, cx, y, cy + h))   { drag.current = { type: "bl", startX: x, startY: y, origCrop: { ...crop } }; return; }
      if (hitHandle(x, cx + w, y, cy + h)) { drag.current = { type: "br", startX: x, startY: y, origCrop: { ...crop } }; return; }
      if (x >= cx && x <= cx + w && y >= cy && y <= cy + h) {
        drag.current = { type: "move", startX: x, startY: y, origCrop: { ...crop } }; return;
      }
    }
    // Only allow free draw when ratio is null
    if (cropRatio !== null) return;
    drag.current = { type: "new", startX: x, startY: y };
    setCrop({ x, y, w: 0, h: 0 });
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!cropEnabled) return;
    const { x, y } = getXY(e);

    // Update cursor
    if (crop && crop.w > 2 && crop.h > 2) {
      const { x: cx, y: cy, w, h } = crop;
      if (hitHandle(x, cx, y, cy) || hitHandle(x, cx + w, y, cy + h)) { setCursor("nwse-resize"); }
      else if (hitHandle(x, cx + w, y, cy) || hitHandle(x, cx, y, cy + h)) { setCursor("nesw-resize"); }
      else if (x >= cx && x <= cx + w && y >= cy && y <= cy + h) { setCursor("move"); }
      else { setCursor(cropRatio !== null ? "default" : "crosshair"); }
    } else {
      setCursor(cropRatio !== null ? "default" : "crosshair");
    }

    if (!drag.current) return;
    const d = drag.current;
    const dx = x - d.startX, dy = y - d.startY;

    if (d.type === "new") {
      const nx = Math.min(d.startX, x), ny = Math.min(d.startY, y);
      setCrop({ x: nx, y: ny, w: Math.abs(x - d.startX), h: Math.abs(y - d.startY) });
    } else if (d.type === "move" && d.origCrop) {
      const o = d.origCrop;
      setCrop({ x: clamp(o.x + dx, 0, displayW - o.w), y: clamp(o.y + dy, 0, displayH - o.h), w: o.w, h: o.h });
    } else if (d.origCrop) {
      const o = d.origCrop;
      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
      const r = cropRatio;

      if (d.type === "tl") {
        nw = clamp(o.w - dx, 4, o.x + o.w); nh = r ? nw / r : clamp(o.h - dy, 4, o.y + o.h);
        nx = o.x + o.w - nw; ny = o.y + o.h - nh;
      }
      if (d.type === "tr") {
        nw = clamp(o.w + dx, 4, displayW - o.x); nh = r ? nw / r : clamp(o.h - dy, 4, o.y + o.h);
        ny = o.y + o.h - nh;
      }
      if (d.type === "bl") {
        nw = clamp(o.w - dx, 4, o.x + o.w); nh = r ? nw / r : clamp(o.h + dy, 4, displayH - o.y);
        nx = o.x + o.w - nw;
      }
      if (d.type === "br") {
        nw = clamp(o.w + dx, 4, displayW - o.x); nh = r ? nw / r : clamp(o.h + dy, 4, displayH - o.y);
      }
      // Keep inside canvas
      if (nx < 0) { nw += nx; if (r) nh = nw / r; nx = 0; }
      if (ny < 0) { nh += ny; if (r) nw = nh * r; ny = 0; }
      if (nx + nw > displayW) { nw = displayW - nx; if (r) nh = nw / r; }
      if (ny + nh > displayH) { nh = displayH - ny; if (r) nw = nh * r; }
      setCrop({ x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) });
    }
  }

  function onMouseUp() { drag.current = null; }

  function selectRatio(ratio: number | null) {
    setCropRatio(ratio);
    setCropEnabled(true);
    if (ratio !== null && displayW && displayH) {
      setCrop(centeredCrop(ratio, displayW, displayH));
    } else if (ratio === null) {
      setCrop(null);
    }
  }

  function changeOutW(v: number) {
    setOutW(v);
    if (lockRatio && naturalW) setOutH(Math.round((v / naturalW) * naturalH));
  }
  function changeOutH(v: number) {
    setOutH(v);
    if (lockRatio && naturalH) setOutW(Math.round((v / naturalH) * naturalW));
  }

  function getEffectiveCrop() {
    if (!cropEnabled || !crop || crop.w < 2 || crop.h < 2) return null;
    const sx = naturalW / displayW, sy = naturalH / displayH;
    return { sx: Math.round(crop.x * sx), sy: Math.round(crop.y * sy), sw: Math.round(crop.w * sx), sh: Math.round(crop.h * sy) };
  }

  function download() {
    const img = imgRef.current;
    if (!img) return;
    const ec = getEffectiveCrop();
    const srcX = ec ? ec.sx : 0, srcY = ec ? ec.sy : 0;
    const srcW = ec ? ec.sw : naturalW, srcH = ec ? ec.sh : naturalH;
    const dstW = outW || srcW, dstH = outH || srcH;
    const offscreen = document.createElement("canvas");
    offscreen.width = dstW; offscreen.height = dstH;
    offscreen.getContext("2d")!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
    const ext = format === "image/webp" ? "webp" : format === "image/jpeg" ? "jpg" : "png";
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}.${ext}`;
      a.click();
    }, format, format === "image/png" ? undefined : quality);
  }

  function reset() {
    setSrc(null); setCrop(null); setCropEnabled(false); setCropRatio(null);
    setNaturalW(0); setNaturalH(0); imgRef.current = null;
  }

  const ext = format === "image/webp" ? "webp" : format === "image/jpeg" ? "jpg" : "png";
  const cropPxW = crop && displayW ? Math.round(crop.w / displayW * naturalW) : 0;
  const cropPxH = crop && displayH ? Math.round(crop.h / displayH * naturalH) : 0;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-navy mb-1">Image Tools</h1>
        <p className="text-sm text-gray-400">Convert, crop, and resize images — processed locally in your browser.</p>
      </div>

      {!src ? (
        <label
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-3 w-full h-64 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-navy/40 hover:text-navy cursor-pointer transition-colors bg-white"
        >
          <Upload className="w-8 h-8" strokeWidth={1.5} />
          <div className="text-center">
            <p className="text-sm font-medium">Drop an image or click to upload</p>
            <p className="text-xs mt-1">JPEG, PNG, WebP, GIF</p>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={onFileInput} />
        </label>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Canvas */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
                <span className="font-medium text-navy">{fileName}</span>
                <span className="text-gray-300">·</span>
                <span>{naturalW} × {naturalH}px</span>
              </div>
              <button onClick={reset} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            <div ref={containerRef} className="p-4 flex justify-center bg-gray-50">
              <canvas
                ref={canvasRef}
                style={{ cursor, maxWidth: "100%", display: "block" }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Crop */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-navy">Crop</h3>

              {/* Ratio presets */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400">Aspect ratio</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {RATIO_PRESETS.map(({ label, value }) => {
                    const isActive = cropEnabled && cropRatio === value;
                    return (
                      <button
                        key={label}
                        onClick={() => selectRatio(value)}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isActive ? "bg-navy text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {cropEnabled && cropRatio === null && (
                <p className="text-xs text-gray-400">Draw freely on the image to select a crop area.</p>
              )}

              {cropEnabled && cropRatio !== null && (
                <p className="text-xs text-gray-400">Drag to move · drag corners to resize.</p>
              )}

              {cropEnabled && crop && crop.w > 2 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-navy/60 bg-gray-50 rounded-lg px-3 py-2">
                    {cropPxW} × {cropPxH}px
                  </span>
                  <button
                    onClick={() => { setCrop(null); setCropEnabled(false); setCropRatio(null); }}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              {!cropEnabled && (
                <p className="text-xs text-gray-400">Select a ratio above to enable cropping.</p>
              )}
            </div>

            {/* Output size */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-navy">Output Size</h3>
                <button
                  onClick={() => setLockRatio((v) => !v)}
                  className="p-1 text-gray-400 hover:text-navy transition-colors"
                  title={lockRatio ? "Unlock ratio" : "Lock ratio"}
                >
                  {lockRatio ? <Lock className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Unlock className="w-3.5 h-3.5" strokeWidth={1.75} />}
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Width (px)</label>
                  <input
                    type="number" min={1} max={8000} value={outW}
                    onChange={(e) => changeOutW(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Height (px)</label>
                  <input
                    type="number" min={1} max={8000} value={outH}
                    onChange={(e) => changeOutH(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  />
                </div>
                <button onClick={() => { setOutW(naturalW); setOutH(naturalH); }} className="text-xs text-gray-400 hover:text-navy text-left transition-colors">
                  Reset to original
                </button>
              </div>
            </div>

            {/* Format & Quality */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-navy">Format & Quality</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Output format</label>
                  <div className="flex gap-1.5">
                    {(["image/webp", "image/jpeg", "image/png"] as Format[]).map((f) => {
                      const label = f === "image/webp" ? "WebP" : f === "image/jpeg" ? "JPEG" : "PNG";
                      return (
                        <button key={f} onClick={() => setFormat(f)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${format === f ? "bg-navy text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {format !== "image/png" && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-400">Quality</label>
                      <span className="text-xs font-semibold text-navy">{Math.round(quality * 100)}%</span>
                    </div>
                    <input type="range" min={10} max={100} value={Math.round(quality * 100)}
                      onChange={(e) => setQuality(Number(e.target.value) / 100)}
                      className="w-full accent-navy" />
                  </div>
                )}
                {format === "image/webp" && (
                  <p className="text-[11px] text-gray-400 leading-relaxed">WebP is recommended — smaller file size with the same visual quality.</p>
                )}
              </div>
            </div>
          </div>

          {/* Download */}
          <div className="flex items-center gap-4">
            <button onClick={download}
              className="flex items-center gap-2 px-6 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors">
              <Download className="w-4 h-4" strokeWidth={2} />
              Download as {ext.toUpperCase()}
            </button>
            <span className="text-xs text-gray-400">
              Output: {outW} × {outH}px
              {cropEnabled && crop && crop.w > 1 ? " (cropped)" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

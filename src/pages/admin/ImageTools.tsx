import { useEffect, useRef, useState } from "react";
import { Upload, Download, X, ImageIcon, Lock, Unlock, Layers, CheckCircle, AlertCircle, Loader, Crop } from "lucide-react";
import JSZip from "jszip";

type Format = "image/webp" | "image/jpeg" | "image/png";
type CropRect = { x: number; y: number; w: number; h: number };

const HANDLE_SIZE = 8;

const RATIO_PRESETS = [
  { label: "Free", value: null },
  { label: "1:1",  value: 1 },
  { label: "4:3",  value: 4 / 3 },
  { label: "3:2",  value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "3:4",  value: 3 / 4 },
  { label: "2:3",  value: 2 / 3 },
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

// ─── Shared crop canvas hook ──────────────────────────────────────────────────

function useCropCanvas(naturalW: number, naturalH: number, maxDisplayW: number, maxDisplayH: number) {
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [cropRatio, setCropRatio] = useState<number | null>(null);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [cursor, setCursor] = useState("crosshair");
  const drag = useRef<{ type: "new"|"move"|"tl"|"tr"|"bl"|"br"; startX: number; startY: number; origCrop?: CropRect } | null>(null);

  useEffect(() => {
    if (!naturalW || !naturalH) return;
    const scale = Math.min(1, maxDisplayW / naturalW, maxDisplayH / naturalH);
    setDisplayW(Math.round(naturalW * scale));
    setDisplayH(Math.round(naturalH * scale));
  }, [naturalW, naturalH, maxDisplayW, maxDisplayH]);

  function drawCanvas(canvas: HTMLCanvasElement, img: HTMLImageElement) {
    if (!displayW || !displayH) return;
    canvas.width = displayW; canvas.height = displayH;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.drawImage(img, 0, 0, displayW, displayH);
    if (cropEnabled && crop && crop.w > 2 && crop.h > 2) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, displayW, displayH);
      ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
      ctx.drawImage(img, 0, 0, displayW, displayH);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 0.75;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(crop.x+(crop.w/3)*i, crop.y); ctx.lineTo(crop.x+(crop.w/3)*i, crop.y+crop.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(crop.x, crop.y+(crop.h/3)*i); ctx.lineTo(crop.x+crop.w, crop.y+(crop.h/3)*i); ctx.stroke();
      }
      [{ x:crop.x,y:crop.y},{x:crop.x+crop.w,y:crop.y},{x:crop.x,y:crop.y+crop.h},{x:crop.x+crop.w,y:crop.y+crop.h}]
        .forEach(({x,y})=>{ ctx.fillStyle="#fff"; ctx.fillRect(x-HANDLE_SIZE/2, y-HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE); });
    }
  }

  function getXY(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: clamp(e.clientX - r.left, 0, displayW), y: clamp(e.clientY - r.top, 0, displayH) };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getXY(e);
    if (crop && crop.w > 2 && crop.h > 2) {
      const { x:cx, y:cy, w, h } = crop;
      if (hitHandle(x,cx,y,cy))       { drag.current={type:"tl",startX:x,startY:y,origCrop:{...crop}}; return; }
      if (hitHandle(x,cx+w,y,cy))     { drag.current={type:"tr",startX:x,startY:y,origCrop:{...crop}}; return; }
      if (hitHandle(x,cx,y,cy+h))     { drag.current={type:"bl",startX:x,startY:y,origCrop:{...crop}}; return; }
      if (hitHandle(x,cx+w,y,cy+h))   { drag.current={type:"br",startX:x,startY:y,origCrop:{...crop}}; return; }
      if (x>=cx&&x<=cx+w&&y>=cy&&y<=cy+h) { drag.current={type:"move",startX:x,startY:y,origCrop:{...crop}}; return; }
    }
    if (cropRatio !== null) return;
    drag.current = { type:"new", startX:x, startY:y };
    setCrop({ x, y, w:0, h:0 });
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getXY(e);
    if (crop && crop.w > 2 && crop.h > 2) {
      const { x:cx, y:cy, w, h } = crop;
      if (hitHandle(x,cx,y,cy)||hitHandle(x,cx+w,y,cy+h)) setCursor("nwse-resize");
      else if (hitHandle(x,cx+w,y,cy)||hitHandle(x,cx,y,cy+h)) setCursor("nesw-resize");
      else if (x>=cx&&x<=cx+w&&y>=cy&&y<=cy+h) setCursor("move");
      else setCursor(cropRatio!==null?"default":"crosshair");
    } else setCursor(cropRatio!==null?"default":"crosshair");
    if (!drag.current) return;
    const d = drag.current, dx=x-d.startX, dy=y-d.startY;
    if (d.type==="new") {
      setCrop({ x:Math.min(d.startX,x), y:Math.min(d.startY,y), w:Math.abs(x-d.startX), h:Math.abs(y-d.startY) });
    } else if (d.type==="move"&&d.origCrop) {
      const o=d.origCrop;
      setCrop({ x:clamp(o.x+dx,0,displayW-o.w), y:clamp(o.y+dy,0,displayH-o.h), w:o.w, h:o.h });
    } else if (d.origCrop) {
      const o=d.origCrop, r=cropRatio;
      let nx=o.x,ny=o.y,nw=o.w,nh=o.h;
      if(d.type==="tl"){nw=clamp(o.w-dx,4,o.x+o.w);nh=r?nw/r:clamp(o.h-dy,4,o.y+o.h);nx=o.x+o.w-nw;ny=o.y+o.h-nh;}
      if(d.type==="tr"){nw=clamp(o.w+dx,4,displayW-o.x);nh=r?nw/r:clamp(o.h-dy,4,o.y+o.h);ny=o.y+o.h-nh;}
      if(d.type==="bl"){nw=clamp(o.w-dx,4,o.x+o.w);nh=r?nw/r:clamp(o.h+dy,4,displayH-o.y);nx=o.x+o.w-nw;}
      if(d.type==="br"){nw=clamp(o.w+dx,4,displayW-o.x);nh=r?nw/r:clamp(o.h+dy,4,displayH-o.y);}
      if(nx<0){nw+=nx;if(r)nh=nw/r;nx=0;} if(ny<0){nh+=ny;if(r)nw=nh*r;ny=0;}
      if(nx+nw>displayW){nw=displayW-nx;if(r)nh=nw/r;} if(ny+nh>displayH){nh=displayH-ny;if(r)nw=nh*r;}
      setCrop({ x:Math.round(nx), y:Math.round(ny), w:Math.round(nw), h:Math.round(nh) });
    }
  }

  function onMouseUp() { drag.current = null; }

  function selectRatio(ratio: number | null) {
    setCropRatio(ratio); setCropEnabled(true);
    if (ratio!==null && displayW && displayH) setCrop(centeredCrop(ratio, displayW, displayH));
    else if (ratio===null) setCrop(null);
  }

  function toPxCrop(nw: number, nh: number): CropRect | null {
    if (!crop || crop.w < 2 || crop.h < 2 || !displayW || !displayH) return null;
    return {
      x: Math.round(crop.x * nw / displayW),
      y: Math.round(crop.y * nh / displayH),
      w: Math.round(crop.w * nw / displayW),
      h: Math.round(crop.h * nh / displayH),
    };
  }

  return { displayW, displayH, crop, cropRatio, cropEnabled, cursor, setCrop, setCropEnabled, setCropRatio, drawCanvas, onMouseDown, onMouseMove, onMouseUp, selectRatio, toPxCrop };
}

// ─── Crop modal (batch per-image) ─────────────────────────────────────────────

type CropModalProps = {
  file: File;
  initialCrop: CropRect | null;
  onConfirm: (crop: CropRect | null) => void;
  onClose: () => void;
};

function CropModal({ file, initialCrop, onConfirm, onClose }: CropModalProps) {
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const maxDW = Math.min(window.innerWidth - 80, 820);
  const maxDH = Math.min(window.innerHeight - 240, 520);

  const cc = useCropCanvas(naturalW, naturalH, maxDW, maxDH);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Restore initial crop scaled to display
  useEffect(() => {
    if (!initialCrop || !cc.displayW || !cc.displayH || !naturalW || !naturalH) return;
    cc.setCrop({
      x: Math.round(initialCrop.x * cc.displayW / naturalW),
      y: Math.round(initialCrop.y * cc.displayH / naturalH),
      w: Math.round(initialCrop.w * cc.displayW / naturalW),
      h: Math.round(initialCrop.h * cc.displayH / naturalH),
    });
    cc.setCropEnabled(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cc.displayW, cc.displayH]);

  useEffect(() => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (canvas && img) cc.drawCanvas(canvas, img);
  });

  function apply() {
    const px = cc.toPxCrop(naturalW, naturalH);
    onConfirm(px);
  }

  const cropPxW = cc.crop && cc.displayW ? Math.round(cc.crop.w / cc.displayW * naturalW) : 0;
  const cropPxH = cc.crop && cc.displayH ? Math.round(cc.crop.h / cc.displayH * naturalH) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-5" onClick={(e) => { if (e.target===e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl overflow-hidden flex flex-col shadow-2xl max-w-full" style={{ maxWidth: maxDW + 40 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-navy text-sm">{file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{naturalW} × {naturalH}px</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-navy rounded-lg transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75}/>
          </button>
        </div>

        {/* Canvas */}
        <div className="bg-gray-50 flex justify-center p-4">
          <canvas
            ref={canvasRef}
            style={{ cursor: cc.cursor, maxWidth: "100%", display: "block" }}
            onMouseDown={cc.onMouseDown}
            onMouseMove={cc.onMouseMove}
            onMouseUp={cc.onMouseUp}
            onMouseLeave={cc.onMouseUp}
          />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 border-t border-gray-100 flex flex-col gap-4">
          {/* Ratio presets */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-gray-400">Aspect ratio</span>
            <div className="flex flex-wrap gap-1.5">
              {RATIO_PRESETS.map(({ label, value }) => (
                <button key={label} onClick={() => cc.selectRatio(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${cc.cropEnabled&&cc.cropRatio===value?"bg-navy text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {cc.cropEnabled && cc.crop && cc.crop.w > 2 ? (
                <span className="text-xs text-navy/60 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">{cropPxW} × {cropPxH}px</span>
              ) : (
                <span className="text-xs text-gray-400">{cc.cropEnabled ? "Draw or pick a ratio" : "Pick a ratio to start"}</span>
              )}
              {cc.crop && cc.crop.w > 2 && (
                <button onClick={() => { cc.setCrop(null); cc.setCropEnabled(false); cc.setCropRatio(null); }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors">Clear</button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onConfirm(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                No Crop
              </button>
              <button onClick={apply}
                disabled={!cc.crop || cc.crop.w < 2}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Single image tool ────────────────────────────────────────────────────────

function SingleTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [fileName, setFileName] = useState("image");
  const [outW, setOutW] = useState(0);
  const [outH, setOutH] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);
  const [quality, setQuality] = useState(0.88);
  const [format, setFormat] = useState<Format>("image/webp");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [maxDW, setMaxDW] = useState(600);
  const maxDH = Math.min(480, window.innerHeight * 0.55);

  const cc = useCropCanvas(naturalW, naturalH, maxDW, maxDH);

  useEffect(() => {
    if (containerRef.current) setMaxDW(containerRef.current.clientWidth);
  }, [src]);

  function loadFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNaturalW(img.naturalWidth); setNaturalH(img.naturalHeight);
      setOutW(img.naturalWidth); setOutH(img.naturalHeight);
      setSrc(url);
      cc.setCrop(null); cc.setCropEnabled(false); cc.setCropRatio(null);
    };
    img.src = url;
    setFileName(file.name.replace(/\.[^.]+$/, ""));
  }

  useEffect(() => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (canvas && img) cc.drawCanvas(canvas, img);
  });

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }
  function onDrop(e: React.DragEvent) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }

  function changeOutW(v: number) { setOutW(v); if (lockRatio && naturalW) setOutH(Math.round((v/naturalW)*naturalH)); }
  function changeOutH(v: number) { setOutH(v); if (lockRatio && naturalH) setOutW(Math.round((v/naturalH)*naturalW)); }

  function download() {
    const img = imgRef.current; if (!img) return;
    const px = cc.toPxCrop(naturalW, naturalH);
    const srcX=px?px.x:0, srcY=px?px.y:0, srcW=px?px.w:naturalW, srcH=px?px.h:naturalH;
    const dstW=outW||srcW, dstH=outH||srcH;
    const off = document.createElement("canvas"); off.width=dstW; off.height=dstH;
    off.getContext("2d")!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
    const ext = format==="image/webp"?"webp":format==="image/jpeg"?"jpg":"png";
    off.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${fileName}.${ext}`; a.click();
    }, format, format==="image/png"?undefined:quality);
  }

  function reset() { setSrc(null); cc.setCrop(null); cc.setCropEnabled(false); cc.setCropRatio(null); setNaturalW(0); setNaturalH(0); imgRef.current=null; }

  const ext = format==="image/webp"?"webp":format==="image/jpeg"?"jpg":"png";
  const cropPxW = cc.crop && cc.displayW ? Math.round(cc.crop.w/cc.displayW*naturalW) : 0;
  const cropPxH = cc.crop && cc.displayH ? Math.round(cc.crop.h/cc.displayH*naturalH) : 0;

  if (!src) return (
    <label onDrop={onDrop} onDragOver={(e)=>e.preventDefault()}
      className="flex flex-col items-center justify-center gap-3 w-full h-64 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-navy/40 hover:text-navy cursor-pointer transition-colors bg-white">
      <Upload className="w-8 h-8" strokeWidth={1.5}/>
      <div className="text-center">
        <p className="text-sm font-medium">Drop an image or click to upload</p>
        <p className="text-xs mt-1">JPEG, PNG, WebP, GIF</p>
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={onFileInput}/>
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ImageIcon className="w-4 h-4" strokeWidth={1.5}/>
            <span className="font-medium text-navy">{fileName}</span>
            <span className="text-gray-300">·</span>
            <span>{naturalW} × {naturalH}px</span>
          </div>
          <button onClick={reset} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75}/>
          </button>
        </div>
        <div ref={containerRef} className="p-4 flex justify-center bg-gray-50">
          <canvas ref={canvasRef} style={{ cursor:cc.cursor, maxWidth:"100%", display:"block" }}
            onMouseDown={cc.onMouseDown} onMouseMove={cc.onMouseMove} onMouseUp={cc.onMouseUp} onMouseLeave={cc.onMouseUp}/>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Crop */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-navy">Crop</h3>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400">Aspect ratio</label>
            <div className="grid grid-cols-4 gap-1.5">
              {RATIO_PRESETS.map(({ label, value }) => (
                <button key={label} onClick={() => cc.selectRatio(value)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${cc.cropEnabled&&cc.cropRatio===value?"bg-navy text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {cc.cropEnabled && cc.cropRatio===null && <p className="text-xs text-gray-400">Draw freely on the image to select a crop area.</p>}
          {cc.cropEnabled && cc.cropRatio!==null && <p className="text-xs text-gray-400">Drag to move · drag corners to resize.</p>}
          {cc.cropEnabled && cc.crop && cc.crop.w > 2 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-navy/60 bg-gray-50 rounded-lg px-3 py-2">{cropPxW} × {cropPxH}px</span>
              <button onClick={() => { cc.setCrop(null); cc.setCropEnabled(false); cc.setCropRatio(null); }} className="text-xs text-red-400 hover:text-red-600 transition-colors">Clear</button>
            </div>
          )}
          {!cc.cropEnabled && <p className="text-xs text-gray-400">Select a ratio above to enable cropping.</p>}
        </div>

        {/* Output size */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy">Output Size</h3>
            <button onClick={() => setLockRatio(v=>!v)} className="p-1 text-gray-400 hover:text-navy transition-colors">
              {lockRatio ? <Lock className="w-3.5 h-3.5" strokeWidth={1.75}/> : <Unlock className="w-3.5 h-3.5" strokeWidth={1.75}/>}
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Width (px)</label>
              <input type="number" min={1} max={8000} value={outW} onChange={(e)=>changeOutW(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Height (px)</label>
              <input type="number" min={1} max={8000} value={outH} onChange={(e)=>changeOutH(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"/>
            </div>
            <button onClick={()=>{setOutW(naturalW);setOutH(naturalH);}} className="text-xs text-gray-400 hover:text-navy text-left transition-colors">Reset to original</button>
          </div>
        </div>

        {/* Format & Quality */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-navy">Format & Quality</h3>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Output format</label>
              <div className="flex gap-1.5">
                {(["image/webp","image/jpeg","image/png"] as Format[]).map((f)=>{
                  const label = f==="image/webp"?"WebP":f==="image/jpeg"?"JPEG":"PNG";
                  return <button key={f} onClick={()=>setFormat(f)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${format===f?"bg-navy text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{label}</button>;
                })}
              </div>
            </div>
            {format!=="image/png" && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Quality</label>
                  <span className="text-xs font-semibold text-navy">{Math.round(quality*100)}%</span>
                </div>
                <input type="range" min={10} max={100} value={Math.round(quality*100)} onChange={(e)=>setQuality(Number(e.target.value)/100)} className="w-full accent-navy"/>
              </div>
            )}
            {format==="image/webp" && <p className="text-[11px] text-gray-400 leading-relaxed">WebP is recommended — smaller file size with the same visual quality.</p>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={download} className="flex items-center gap-2 px-6 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors">
          <Download className="w-4 h-4" strokeWidth={2}/>
          Download as {ext.toUpperCase()}
        </button>
        <span className="text-xs text-gray-400">
          Output: {outW} × {outH}px{cc.cropEnabled&&cc.crop&&cc.crop.w>1?" (cropped)":""}
        </span>
      </div>
    </div>
  );
}

// ─── Batch tool ───────────────────────────────────────────────────────────────

type BatchFile = {
  id: string;
  file: File;
  thumb: string;
  cropPx: CropRect | null;
  status: "idle" | "processing" | "done" | "error";
};

function BatchTool() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [format, setFormat] = useState<Format>("image/webp");
  const [quality, setQuality] = useState(0.88);
  const [maxW, setMaxW] = useState<number | "">("");
  const [maxH, setMaxH] = useState<number | "">("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cropModalId, setCropModalId] = useState<string | null>(null);

  const cropTarget = files.find(f => f.id === cropModalId) ?? null;

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming).filter(f => f.type.startsWith("image/"));
    const next: BatchFile[] = arr.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file, thumb: URL.createObjectURL(file), cropPx: null, status: "idle",
    }));
    setFiles(prev => [...prev, ...next]);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }
  function onDrop(e: React.DragEvent) { e.preventDefault(); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }
  function removeFile(id: string) { setFiles(prev => prev.filter(f => f.id !== id)); }
  function clearAll() { setFiles([]); setProgress(0); }

  function saveCrop(id: string, crop: CropRect | null) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, cropPx: crop } : f));
    setCropModalId(null);
  }

  function processImage(bf: BatchFile): Promise<Blob | null> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(bf.file);
      img.onload = () => {
        const px = bf.cropPx;
        const srcX = px ? px.x : 0, srcY = px ? px.y : 0;
        const srcW = px ? px.w : img.naturalWidth, srcH = px ? px.h : img.naturalHeight;
        let dstW = srcW, dstH = srcH;
        if (maxW || maxH) {
          const scaleW = maxW ? (maxW as number) / dstW : Infinity;
          const scaleH = maxH ? (maxH as number) / dstH : Infinity;
          const scale = Math.min(1, scaleW, scaleH);
          dstW = Math.round(dstW * scale); dstH = Math.round(dstH * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = dstW; canvas.height = dstH;
        canvas.getContext("2d")!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
        URL.revokeObjectURL(url);
        canvas.toBlob(resolve, format, format === "image/png" ? undefined : quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  async function convertAll() {
    if (files.length === 0 || running) return;
    setRunning(true); setProgress(0);
    const ext = format === "image/webp" ? "webp" : format === "image/jpeg" ? "jpg" : "png";
    const zip = new JSZip();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setFiles(prev => prev.map(x => x.id===f.id ? { ...x, status:"processing" } : x));
      const blob = await processImage(f);
      const baseName = f.file.name.replace(/\.[^.]+$/, "");
      if (blob) { zip.file(`${baseName}.${ext}`, blob); setFiles(prev => prev.map(x => x.id===f.id ? { ...x, status:"done" } : x)); }
      else { setFiles(prev => prev.map(x => x.id===f.id ? { ...x, status:"error" } : x)); }
      setProgress(i + 1);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(zipBlob); a.download="images-converted.zip"; a.click();
    setRunning(false);
  }

  const ext = format === "image/webp" ? "webp" : format === "image/jpeg" ? "jpg" : "png";
  const doneCount = files.filter(f => f.status === "done").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const croppedCount = files.filter(f => f.cropPx).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-navy">Format & Quality</h3>
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5">
              {(["image/webp","image/jpeg","image/png"] as Format[]).map((f)=>{
                const label = f==="image/webp"?"WebP":f==="image/jpeg"?"JPEG":"PNG";
                return <button key={f} onClick={()=>setFormat(f)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${format===f?"bg-navy text-white":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{label}</button>;
              })}
            </div>
            {format !== "image/png" && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Quality</label>
                  <span className="text-xs font-semibold text-navy">{Math.round(quality*100)}%</span>
                </div>
                <input type="range" min={10} max={100} value={Math.round(quality*100)} onChange={(e)=>setQuality(Number(e.target.value)/100)} className="w-full accent-navy"/>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-navy">Max Size</h3>
            <p className="text-xs text-gray-400 mt-1">Scales down proportionally. Leave blank to keep original.</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Max width (px)</label>
              <input type="number" min={1} max={8000} value={maxW} placeholder="e.g. 1200"
                onChange={(e)=>setMaxW(e.target.value===""?"":Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy placeholder-gray-300"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Max height (px)</label>
              <input type="number" min={1} max={8000} value={maxH} placeholder="e.g. 800"
                onChange={(e)=>setMaxH(e.target.value===""?"":Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy placeholder-gray-300"/>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-navy">Summary</h3>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-gray-400">Files</span><span className="font-semibold text-navy">{files.length}</span></div>
            <div className="flex items-center justify-between"><span className="text-gray-400">Cropped</span><span className="font-semibold text-navy">{croppedCount} of {files.length}</span></div>
            <div className="flex items-center justify-between"><span className="text-gray-400">Format</span><span className="font-semibold text-navy">{ext.toUpperCase()}</span></div>
            <div className="flex items-center justify-between"><span className="text-gray-400">Max size</span><span className="font-semibold text-navy">{maxW||maxH?`${maxW||"—"} × ${maxH||"—"}px`:"Original"}</span></div>
          </div>
          {running && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gray-400"><span>Processing…</span><span>{progress}/{files.length}</span></div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-navy rounded-full transition-all duration-300" style={{ width:`${(progress/files.length)*100}%` }}/>
              </div>
            </div>
          )}
          {!running && progress > 0 && (
            <div className="flex flex-col gap-1 text-xs">
              {doneCount > 0 && <span className="text-green-600">{doneCount} converted successfully</span>}
              {errorCount > 0 && <span className="text-red-500">{errorCount} failed</span>}
            </div>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <label onDrop={onDrop} onDragOver={(e)=>e.preventDefault()}
        className="flex flex-col items-center justify-center gap-3 w-full h-36 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-navy/40 hover:text-navy cursor-pointer transition-colors bg-white">
        <Upload className="w-6 h-6" strokeWidth={1.5}/>
        <div className="text-center">
          <p className="text-sm font-medium">Drop images or click to add</p>
          <p className="text-xs mt-0.5">Select multiple files at once</p>
        </div>
        <input type="file" accept="image/*" multiple className="hidden" onChange={onFileInput}/>
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-navy">{files.length} image{files.length!==1?"s":""}</span>
            <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear all</button>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                <div className="relative flex-shrink-0">
                  <img src={f.thumb} alt={f.file.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100"/>
                  {f.cropPx && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-copper rounded-full flex items-center justify-center">
                      <Crop className="w-2.5 h-2.5 text-white" strokeWidth={2.5}/>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{f.file.name}</p>
                  <p className="text-xs text-gray-400">
                    {(f.file.size/1024).toFixed(0)} KB
                    {f.cropPx && <span className="ml-2 text-copper font-medium">{f.cropPx.w} × {f.cropPx.h}px cropped</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {f.status === "idle"       && <span className="text-xs text-gray-300">—</span>}
                  {f.status === "processing" && <Loader className="w-4 h-4 text-navy/40 animate-spin" strokeWidth={1.75}/>}
                  {f.status === "done"       && <CheckCircle className="w-4 h-4 text-green-500" strokeWidth={1.75}/>}
                  {f.status === "error"      && <AlertCircle className="w-4 h-4 text-red-400" strokeWidth={1.75}/>}
                  {!running && (
                    <>
                      <button onClick={() => setCropModalId(f.id)}
                        className={`p-1.5 rounded-lg transition-colors ${f.cropPx?"text-copper hover:bg-copper/10":"text-gray-400 hover:text-navy hover:bg-gray-100"}`}
                        title="Crop this image">
                        <Crop className="w-3.5 h-3.5" strokeWidth={1.75}/>
                      </button>
                      <button onClick={() => removeFile(f.id)} className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5" strokeWidth={1.75}/>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="flex items-center gap-4">
        <button onClick={convertAll} disabled={files.length===0||running}
          className="flex items-center gap-2 px-6 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Download className="w-4 h-4" strokeWidth={2}/>
          {running ? "Converting…" : "Convert all & download ZIP"}
        </button>
        {files.length > 0 && !running && (
          <span className="text-xs text-gray-400">{files.length} file{files.length!==1?"s":""} → images-converted.zip</span>
        )}
      </div>

      {/* Crop modal */}
      {cropTarget && (
        <CropModal
          file={cropTarget.file}
          initialCrop={cropTarget.cropPx}
          onConfirm={(crop) => saveCrop(cropTarget.id, crop)}
          onClose={() => setCropModalId(null)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImageTools() {
  const [tab, setTab] = useState<"single"|"batch">("single");

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-navy mb-1">Image Tools</h1>
        <p className="text-sm text-gray-400">Convert, crop, and resize images — processed locally in your browser.</p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        <button onClick={()=>setTab("single")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab==="single"?"bg-white text-navy shadow-sm":"text-gray-500 hover:text-navy"}`}>
          <ImageIcon className="w-4 h-4" strokeWidth={1.75}/>
          Single
        </button>
        <button onClick={()=>setTab("batch")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab==="batch"?"bg-white text-navy shadow-sm":"text-gray-500 hover:text-navy"}`}>
          <Layers className="w-4 h-4" strokeWidth={1.75}/>
          Batch
        </button>
      </div>

      {tab === "single" ? <SingleTool /> : <BatchTool />}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { useSignedImage } from "../hooks/useSignedImage";
import { classifyImageValue } from "../lib/customerUpload";
import { useLang } from "../context/LanguageContext";

type Props = {
  value: string;
  token: string | undefined;
  label: string;
  sizeClass?: string;
  onExpiredChange?: (unavailable: boolean) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export function CustomerImageDisplay({
  value,
  token,
  label,
  sizeClass = "w-20 h-20",
  onExpiredChange,
  onLoadingChange,
}: Props) {
  const { tr } = useLang();
  const { url, loading, expired, legacy } = useSignedImage(value, token);

  // Use refs so effects only re-run when state values change, not when callback
  // identity changes due to parent re-renders with inline function expressions.
  const onExpiredRef = useRef(onExpiredChange);
  useEffect(() => { onExpiredRef.current = onExpiredChange; });

  const onLoadingRef = useRef(onLoadingChange);
  useEffect(() => { onLoadingRef.current = onLoadingChange; });

  // Propagate unavailability to parent. Both expired (bad token) and legacy
  // (old CDN URL — not a verified secure upload) block checkout.
  useEffect(() => {
    onExpiredRef.current?.(expired || legacy);
  }, [expired, legacy]);

  useEffect(() => {
    onLoadingRef.current?.(loading);
  }, [loading]);

  if (classifyImageValue(value) === "other") return null;

  if (loading) {
    return (
      <div className={`${sizeClass} rounded-lg border border-gray-200 bg-gray-100 animate-pulse`} />
    );
  }

  // Legacy CDN URL — not a verified secure upload; user must re-upload.
  if (legacy) {
    return (
      <div
        className={`${sizeClass} rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-center p-1 text-center`}
        title={label}
      >
        <span className="text-[9px] leading-tight text-amber-600">
          {tr("upload_photo_legacy")}
        </span>
      </div>
    );
  }

  if (expired) {
    return (
      <div
        className={`${sizeClass} rounded-lg border border-red-200 bg-red-50 flex items-center justify-center p-1 text-center`}
        title={label}
      >
        <span className="text-[9px] leading-tight text-red-400">
          {tr("upload_photo_unavailable")}
        </span>
      </div>
    );
  }

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="inline-block">
        <div
          className={`${sizeClass} rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity`}
        >
          <img src={url} alt={label} className="w-full h-full object-contain" />
        </div>
      </a>
    );
  }

  return null;
}

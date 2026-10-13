import { useEffect, useRef } from "react";
import { useSignedImage } from "../hooks/useSignedImage";
import { classifyImageValue } from "../lib/customerUpload";
import { useLang } from "../context/LanguageContext";

type Props = {
  value: string;
  token: string | undefined;
  label: string;
  sizeClass?: string;
  onExpiredChange?: (expired: boolean) => void;
};

export function CustomerImageDisplay({
  value,
  token,
  label,
  sizeClass = "w-20 h-20",
  onExpiredChange,
}: Props) {
  const { lang } = useLang();
  const { url, loading, expired } = useSignedImage(value, token);

  // Use a ref so the effect only depends on `expired`, not on the callback identity.
  const onExpiredRef = useRef(onExpiredChange);
  useEffect(() => {
    onExpiredRef.current = onExpiredChange;
  });
  useEffect(() => {
    onExpiredRef.current?.(expired);
  }, [expired]);

  if (classifyImageValue(value) === "other") return null;

  if (loading) {
    return (
      <div
        className={`${sizeClass} rounded-lg border border-gray-200 bg-gray-100 animate-pulse`}
      />
    );
  }

  if (expired) {
    return (
      <div
        className={`${sizeClass} rounded-lg border border-red-200 bg-red-50 flex items-center justify-center p-1 text-center`}
        title={label}
      >
        <span className="text-[9px] leading-tight text-red-400">
          {lang === "bs" ? "Foto nedostupna" : "Photo unavailable"}
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

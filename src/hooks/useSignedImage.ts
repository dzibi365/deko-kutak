import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { classifyImageValue } from "../lib/customerUpload";

export type SignedImageState = {
  url: string | null;
  loading: boolean;
  expired: boolean;
};

export function useSignedImage(
  value: string,
  token: string | undefined,
): SignedImageState {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const type = classifyImageValue(value);

    if (type === "legacy-url") {
      setUrl(value);
      setLoading(false);
      setExpired(false);
      return;
    }

    if (type !== "storage-path") {
      setUrl(null);
      setLoading(false);
      setExpired(false);
      return;
    }

    if (!token) {
      setUrl(null);
      setLoading(false);
      setExpired(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setExpired(false);
    setUrl(null);

    supabase.functions
      .invoke("sign-image-url", { body: { path: value, token } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && typeof (data as Record<string, unknown>)?.url === "string") {
          setUrl((data as Record<string, string>).url);
          setExpired(false);
        } else {
          setExpired(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setExpired(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, token]);

  return { url, loading, expired };
}

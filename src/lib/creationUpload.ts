import { supabase } from "./supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function validateCreationPhoto(file: File): "invalid_type" | "too_large" | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "invalid_type";
  if (file.size > MAX_FILE_SIZE) return "too_large";
  return null;
}

export async function uploadCreationPhoto(
  file: File,
  idempotencyKey: string,
): Promise<{ token: string; previewUrl: string | null }> {
  const form = new FormData();
  form.append("file", file);
  form.append("idempotency_key", idempotencyKey);

  const { data, error } = await supabase.functions.invoke("creation-upload", {
    body: form,
  });

  if (error) {
    let message = (error as { message?: string }).message ?? "Upload failed";
    try {
      const body = await (
        error as { context?: { json?: () => Promise<{ error?: string }> } }
      ).context?.json?.();
      if (body?.error) message = body.error;
    } catch {}
    const status =
      (error as { context?: { status?: number } }).context?.status ?? 0;
    throw Object.assign(new Error(message), { status });
  }

  const d = data as Record<string, unknown>;
  const token = d?.token;
  if (typeof token !== "string") {
    throw new Error(
      typeof d?.error === "string" ? String(d.error) : "Upload failed",
    );
  }

  return {
    token,
    previewUrl: typeof d?.preview_url === "string" ? String(d.preview_url) : null,
  };
}

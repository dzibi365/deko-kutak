import { type VercelConfig } from "@vercel/config/v1";

// STAGING PROTECTION
// When VITE_ALLOW_INDEXING is not set (or set to anything other than "true"),
// every response gets X-Robots-Tag: noindex so search engines ignore this deployment.
// To enable indexing on production, add VITE_ALLOW_INDEXING=true to the Vercel
// project's environment variables (Settings → Environment Variables → Production only).
const allowIndexing = process.env.VITE_ALLOW_INDEXING === "true";

export const config: VercelConfig = {
  rewrites: [{ source: "/(.*)", destination: "/index.html" }],
  headers: allowIndexing
    ? []
    : [
        {
          source: "/(.*)",
          headers: [{ key: "X-Robots-Tag", value: "noindex" }],
        },
      ],
};

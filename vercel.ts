import { type VercelConfig } from "@vercel/config/v1";

// STAGING PROTECTION
// When VITE_ALLOW_INDEXING is not set (or set to anything other than "true"),
// every response gets X-Robots-Tag: noindex so search engines ignore this deployment.
// To enable indexing on production, add VITE_ALLOW_INDEXING=true to the Vercel
// project's environment variables (Settings → Environment Variables → Production only).
const allowIndexing = process.env.VITE_ALLOW_INDEXING === "true";

// ─── CSP origins ──────────────────────────────────────────────────────────────
const SUPABASE     = "https://smlaoqjushalotduuhcx.supabase.co";
const SUPABASE_WSS = "wss://smlaoqjushalotduuhcx.supabase.co";
const TURNSTILE    = "https://challenges.cloudflare.com";

// Content-Security-Policy
// script-src:   bundled app (self) + Cloudflare Turnstile widget
// style-src:    unsafe-inline required — React style={{}} props compile to
//               HTML style="" attributes which CSP treats as inline styles
// img-src:      self (built assets) + data: (placeholder images in HomeSections)
//               + blob: (admin image-tool previews) + Supabase storage
// font-src:     self-hosted Inter via /fonts/
// connect-src:  Supabase REST/auth/storage/functions + Supabase Realtime (wss)
//               + Turnstile verification calls
// media-src:    Supabase storage (workshop and gallery videos)
// frame-src:    Turnstile iframe + YouTube embeds in admin rich-text editor
// frame-ancestors 'none': disallow embedding this site in any frame
const csp = [
  "default-src 'self'",
  `script-src 'self' ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE}`,
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE} ${SUPABASE_WSS} ${TURNSTILE}`,
  `media-src 'self' ${SUPABASE}`,
  `frame-src ${TURNSTILE} https://www.youtube.com https://www.youtube-nocookie.com`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

// Security headers applied to every response on every path.
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options",  value: "nosniff" },
  // Deny framing (belt-and-suspenders with frame-ancestors in CSP)
  { key: "X-Frame-Options",         value: "DENY" },
  // Send origin only for cross-origin requests; full URL for same-origin
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  // Disable features the site does not use
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: csp },
];

export const config: VercelConfig = {
  rewrites: [
    { source: "/robots.txt",  destination: "/api/robots"  },
    { source: "/sitemap.xml", destination: "/api/sitemap" },
    { source: "/(.*)",        destination: "/index.html"  },
  ],
  headers: [
    {
      source: "/(.*)",
      headers: [
        ...securityHeaders,
        // Staging / preview: hide from search engines until production launch.
        // Remove by setting VITE_ALLOW_INDEXING=true on the production Vercel project.
        ...(allowIndexing ? [] : [{ key: "X-Robots-Tag", value: "noindex" }]),
      ],
    },
  ],
};

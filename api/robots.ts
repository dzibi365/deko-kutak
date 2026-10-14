import type { IncomingMessage, ServerResponse } from "http";

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  const isProd = process.env.VITE_ALLOW_INDEXING === "true";

  const content = isProd
    ? `User-agent: *
Allow: /
Disallow: /admin
Disallow: /checkout
Disallow: /cart
Disallow: /account
Disallow: /order-confirmation
Disallow: /reset-password

Sitemap: https://dekokutak.ba/sitemap.xml
`
    : `User-agent: *
Disallow: /
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(content);
}

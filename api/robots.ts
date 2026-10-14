export default function handler(_req: Request): Response {
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

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

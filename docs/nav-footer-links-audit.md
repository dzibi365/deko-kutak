# DEKO KUTAK — Navigation & Footer Links Audit

Date: 2026-10-09

---

## Audit Table

| Link / Element | Location | Current destination | Working? | Recommended destination | Admin editable? | Priority |
|---|---|---|---|---|---|---|
| **Header — Desktop & Mobile** | | | | | | |
| Logo | Desktop + Mobile nav | `href="/"` | ✅ Yes | Keep `href="/"` | No (code) | — |
| Shop | Desktop nav | `href="#"` | ❌ No | `/shop` | No (code) | **HIGH** |
| Our Story | Desktop nav | `href="#"` | ❌ No | `/story` (page needed) | No (code) | LOW |
| Journal | Desktop nav | `href="#"` | ❌ No | `/journal` (page needed) | No (code) | LOW |
| Contact | Desktop nav | `href="#"` | ❌ No | `/#contact` section or `/contact` | No (code) | MEDIUM |
| Shop | Mobile nav | `href="#"` | ❌ No | `/shop` | No (code) | **HIGH** |
| Our Story | Mobile nav | `href="#"` | ❌ No | `/story` | No (code) | LOW |
| Journal | Mobile nav | `href="#"` | ❌ No | `/journal` | No (code) | LOW |
| Contact | Mobile nav | `href="#"` | ❌ No | Contact section / page | No (code) | MEDIUM |
| Language switcher | Desktop + Mobile | `toggleLang()` button | ✅ Yes | — | No | — |
| Search icon | Desktop only | button (opens search) | ✅ Yes | — | No | — |
| Account icon | Desktop | Opens auth modal / dropdown | ✅ Yes | — | No | — |
| Cart icon | Desktop + Mobile | Opens `CartDrawer` | ✅ Yes | — | No | — |
| My Account (dropdown) | Desktop | `/account` | ✅ Yes | — | No | — |
| Admin Panel (dropdown) | Desktop | `/admin` | ✅ Yes | — | No | — |
| Sign out (dropdown) | Desktop | `signOut()` | ✅ Yes | — | No | — |
| **Footer — Shop column** | | | | | | |
| All Products | Footer | `href="#"` | ❌ No | `/shop` | No (code) | **HIGH** |
| New Arrivals | Footer | `href="#"` | ❌ No | `/shop` (filtered shop has no "new" sort yet) | No (code) | MEDIUM |
| Custom Orders | Footer | `href="#"` | ❌ No | `/shop` (personalization is per-product; no dedicated page) | No (code) | LOW |
| Gift Cards | Footer | `href="#"` | ❌ No | Remove or `/shop` until feature exists | No (code) | LOW |
| **Footer — Support column** | | | | | | |
| FAQ | Footer | `href="#"` | ❌ No | `/faq` (page needed, admin-editable content) | **Yes** | MEDIUM |
| Shipping & Returns | Footer | `href="#"` | ❌ No | `/shipping` (page needed, admin-editable content) | **Yes** | MEDIUM |
| Care Instructions | Footer | `href="#"` | ❌ No | `/care` (page needed, admin-editable content) | **Yes** | LOW |
| Contact Us | Footer | `href="#"` | ❌ No | `mailto:` from `social_email` or Viber/WhatsApp | **Yes** (email in settings) | MEDIUM |
| **Footer — Social icons** | | | | | | |
| Instagram | Footer | `social_instagram` from DB | ✅ Yes (conditional) | — | ✅ Already (StoreSettings) | — |
| Facebook | Footer | `social_facebook` from DB | ✅ Yes (conditional) | — | ✅ Already (StoreSettings) | — |
| Email | Footer | `social_email` from DB | ✅ Yes (conditional) | — | ✅ Already (StoreSettings) | — |
| **Footer — Bottom bar** | | | | | | |
| Privacy Policy | Footer bottom | `href="#"` | ❌ No | `/privacy` (page needed, admin-editable content) | **Yes** | **HIGH** (legal) |
| Terms of Service | Footer bottom | `href="#"` | ❌ No | `/terms` (page needed, admin-editable content) | **Yes** | **HIGH** (legal) |
| Copyright text | Footer bottom | `store_name` from DB | ✅ Yes | — | ✅ Already (store_name) | — |

---

## 1. Complete list of placeholder links

All of these are `href="#"` in `src/components/Layout.tsx`:

```
Desktop nav:    Shop, Our Story, Journal, Contact
Mobile nav:     Shop, Our Story, Journal, Contact  (same 4)
Footer Shop:    All Products, New Arrivals, Custom Orders, Gift Cards
Footer Support: FAQ, Shipping & Returns, Care Instructions, Contact Us
Footer bottom:  Privacy Policy, Terms of Service
```

**Total: 14 placeholder links** (12 distinct destinations).

---

## 2. Existing routes that can be reused

| Route | Page | Can be linked to |
|---|---|---|
| `/shop` | `Shop.tsx` — full product grid with category filter + search | Shop nav, All Products footer, New Arrivals footer |
| `/shop?category=X` | Same page, pre-filtered | Category-specific footer links if added |
| `/products/:id` | `ProductDetail.tsx` | Already reached via product cards — no nav change needed |
| `/account` | `Account.tsx` | Already wired in dropdown |
| `/checkout` | `Checkout.tsx` | Already reached via cart |

---

## 3. Missing pages that should be created

**Legal — create first (customer trust & compliance):**
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service

**Customer support — create next:**
- `/faq` — Frequently Asked Questions
- `/shipping` — Shipping & Returns

**Optional / lower priority:**
- `/care` — Care Instructions
- `/story` — Our Story (marketing; could also be a homepage section)
- `/contact` — Contact page (Viber + WhatsApp + email form; less critical since floating buttons exist)
- `/journal` — Blog (requires article/CMS system — significant scope, not recommended near-term)

**Not worth creating as pages:**
- Custom Orders — the per-product `requires_personalization` flow handles this; link to `/shop`
- Gift Cards — no product/feature backing it; remove or link to `/shop`

---

## 4. Which links should be admin-editable

| Concern | Recommendation |
|---|---|
| Nav link **labels** | Already bilingual via `translations.ts` — no admin needed |
| Nav link **destinations** | Hard-code in `Layout.tsx` — they are technical routes, not content |
| Footer link **labels** | Already bilingual via `translations.ts` — no admin needed |
| Footer link **destinations** | Hard-code in `Layout.tsx` — same reason |
| Informational page **content** (Privacy, Terms, FAQ, Shipping, Care) | Admin-editable — store rich text in a `pages` Supabase table (`slug`, `title_en`, `title_bs`, `content_en`, `content_bs`); one admin form serves all |
| "Contact Us" footer link | Wire to `social_email` from `store_settings` (`mailto:`) — already admin-editable |
| Social links | Already admin-editable via StoreSettings ✅ |

---

## 5. Recommended implementation order

| Step | Work | Impact |
|---|---|---|
| 1 | Wire Shop nav links (desktop + mobile) → `/shop` | Customers can browse immediately — 1-line change each |
| 2 | Wire footer "All Products" → `/shop`, "New Arrivals" → `/shop` | Same session |
| 3 | Wire "Contact Us" footer → `mailto:${social_email}` (already in context) | Zero new DB work |
| 4 | Create Privacy Policy + Terms of Service pages (`/privacy`, `/terms`) with admin-editable content | Legal requirement |
| 5 | Create FAQ + Shipping & Returns pages (`/faq`, `/shipping`) | Reduces support contacts |
| 6 | Our Story page or section (`/story`) | Marketing; low risk |
| 7 | Remove or redirect Gift Cards footer link | Cleanup |
| 8 | Journal/Blog | Large scope — evaluate separately |

Steps 1–3 touch only `Layout.tsx`, no database changes needed.
Steps 4–5 need a `pages` table and one new admin route.
Steps 6–8 are optional / future.

---

## 6. Risks

| Risk | Detail |
|---|---|
| App-wide 404 catch-all | `App.tsx` has `<Route path="*" ... redirect to />` — any typo'd URL silently redirects to home instead of a 404. Low risk for now. |
| SEO for informational pages | `/privacy`, `/terms`, `/faq`, `/shipping` will be indexed once production goes live. Each needs a correct `<SiteMeta>`. No risk with current staging setup. |
| Cart / checkout | None of the broken links touch the cart or checkout flow — zero risk. |
| Existing product navigation | Product cards already navigate to `/products/:id` via `useNavigate` — unaffected. |
| Mobile menu close behavior | Mobile nav links call `setMenuOpen(false)` on click. When fixed to real routes, this behavior must be preserved so the menu closes after navigation. |

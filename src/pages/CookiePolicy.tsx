import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { SiteMeta } from "../components/SiteMeta";
import { useLang } from "../context/LanguageContext";
import { useConsent } from "../context/ConsentContext";

export default function CookiePolicy() {
  const { lang } = useLang();
  const { openPreferences } = useConsent();

  const isBS = lang === "bs";

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <SiteMeta title={isBS ? "Politika kolačića" : "Cookie Policy"} />
      <Navbar />
      <CartDrawer />
      <AuthModal />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-semibold text-navy mb-8">
          {isBS ? "Politika kolačića" : "Cookie Policy"}
        </h1>

        {isBS ? (
          <div className="prose prose-navy max-w-none space-y-6 text-navy/80 leading-relaxed">
            <p>
              Ova stranica objašnjava kako Deko Kutak koristi kolačiće (cookies) i slične tehnologije na
              web stranici <strong>emir.dekokutak.ba</strong>.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Šta su kolačići?</h2>
            <p>
              Kolačići su male tekstualne datoteke koje se pohranjuju na vašem uređaju kada posjetite web
              stranicu. Koriste se za pamćenje vaših preferencija i osiguravanje funkcionisanja stranice.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Koje kolačiće koristimo?</h2>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Neophodni kolačići</h3>
            <p>
              Ovi kolačići su neophodni za funkcionisanje prodavnice. Bez njih stranica ne može ispravno
              raditi. Uključuju:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><code className="text-sm bg-gray-100 px-1 rounded">cart</code> — sadržaj vaše korpe</li>
              <li><code className="text-sm bg-gray-100 px-1 rounded">lang</code> — preferenca jezika (bosanski/engleski)</li>
              <li><code className="text-sm bg-gray-100 px-1 rounded">dk-consent</code> — vaš odabir kolačića</li>
              <li>Supabase sesijski kolačići za prijavljene korisnike</li>
            </ul>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Analitički kolačići</h3>
            <p>
              Pomažu nam razumjeti kako posjetitelji koriste stranicu. <strong>Trenutno nisu aktivni</strong> —
              nijedan analitički alat nije instaliran. Ukoliko ih aktiviramo u budućnosti, ažuriraćemo ovu
              stranicu i tražiti vaš pristanak.
            </p>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Marketing kolačići</h3>
            <p>
              Koriste se za prikazivanje relevantnih oglasa. <strong>Trenutno nisu aktivni</strong> — nijedan
              marketinški alat nije instaliran.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Upravljanje kolačićima</h2>
            <p>
              Možete u svakom trenutku promijeniti svoje preferencije kolačića klikom na dugme ispod ili
              putem linka „Postavke kolačića" u dnu svake stranice.
            </p>
            <button
              type="button"
              onClick={openPreferences}
              className="inline-block mt-2 px-5 py-2.5 rounded-md border border-[var(--color-copper)] text-white bg-[var(--color-copper)] hover:opacity-90 text-sm font-medium transition-opacity"
            >
              Postavke kolačića
            </button>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Kolačići trećih strana</h2>
            <p>
              Koristimo Supabase za autentifikaciju i bazu podataka. Supabase može postaviti sesijske
              kolačiće potrebne za prijavu. Fontovi se učitavaju lokalno s naših servera — ne šalju se
              zahtjevi prema Google Fonts CDN-u.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Kontakt</h2>
            <p>
              Za pitanja u vezi s kolačićima možete nas kontaktirati putem e-maila navedenog na stranici.
            </p>

            <p className="text-sm text-navy/50 mt-10">
              Posljednje ažuriranje: oktobar 2026.
            </p>
          </div>
        ) : (
          <div className="prose prose-navy max-w-none space-y-6 text-navy/80 leading-relaxed">
            <p>
              This page explains how Deko Kutak uses cookies and similar technologies on{" "}
              <strong>emir.dekokutak.ba</strong>.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">What are cookies?</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They are used
              to remember your preferences and ensure the site works correctly.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">What cookies do we use?</h2>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Necessary cookies</h3>
            <p>
              These cookies are required for the shop to function. Without them, the site cannot work
              properly. They include:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><code className="text-sm bg-gray-100 px-1 rounded">cart</code> — the contents of your cart</li>
              <li><code className="text-sm bg-gray-100 px-1 rounded">lang</code> — your language preference (Bosnian/English)</li>
              <li><code className="text-sm bg-gray-100 px-1 rounded">dk-consent</code> — your cookie choices</li>
              <li>Supabase session cookies for signed-in users</li>
            </ul>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Analytics cookies</h3>
            <p>
              These help us understand how visitors use the site. <strong>Currently inactive</strong> — no
              analytics tool is installed. If we activate them in the future, we will update this page and
              request your consent.
            </p>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Marketing cookies</h3>
            <p>
              Used to show relevant ads. <strong>Currently inactive</strong> — no marketing tool is
              installed.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Managing your preferences</h2>
            <p>
              You can change your cookie preferences at any time by clicking the button below or via the
              "Cookie settings" link in the footer of every page.
            </p>
            <button
              type="button"
              onClick={openPreferences}
              className="inline-block mt-2 px-5 py-2.5 rounded-md border border-[var(--color-copper)] text-white bg-[var(--color-copper)] hover:opacity-90 text-sm font-medium transition-opacity"
            >
              Cookie settings
            </button>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Third-party cookies</h2>
            <p>
              We use Supabase for authentication and database services. Supabase may set session cookies
              needed for sign-in. Fonts are loaded locally from our servers — no requests are made to the
              Google Fonts CDN.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Contact</h2>
            <p>
              For questions about cookies, please contact us via the email address listed on the site.
            </p>

            <p className="text-sm text-navy/50 mt-10">Last updated: October 2026.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

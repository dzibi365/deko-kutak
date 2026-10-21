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
              Ova stranica objašnjava kako Deko Kutak koristi kolačiće (cookies) i slične tehnologije pohrane
              podataka na web stranici <strong>dekokutak.ba</strong>.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Šta su kolačići?</h2>
            <p>
              Kolačići su male tekstualne datoteke koje web stranica šalje vašem pretraživaču i koje se
              pohranjuju na vašem uređaju. Pored kolačića, web stranice mogu koristiti i <strong>localStorage</strong>{" "}
              i <strong>sessionStorage</strong> — slične tehnologije koje pohranjuju podatke direktno u vaš
              pretraživač bez slanja na server. Deko Kutak ne postavlja HTTP kolačiće putem aplikacijskog koda;
              umjesto toga koristimo localStorage i sessionStorage za funkcionisanje prodavnice.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Šta pohranjujemo u vašem pretraživaču?</h2>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Neophodno pohranjeni sadržaj</h3>
            <p>
              Sljedeći podaci pohranjuju se kako bi prodavnica ispravno funkcionisala:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">cart</code>{" "}
                (localStorage) — sadržaj vaše korpe, čuva se dok ga ne obrišete
              </li>
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">lang</code>{" "}
                (localStorage) — vaša preferenca jezika (bosanski ili engleski)
              </li>
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">dk-consent</code>{" "}
                (localStorage) — vaš odabir postavki pohrane, čuva se 365 dana
              </li>
              <li>
                Supabase autentifikacijska sesija (localStorage) — vaša sesija prijave, pohranjena lokalno
                u vašem pretraživaču kada se prijavite ili registrujete. Briše se odjavom ili automatskim
                istekom sesije.
              </li>
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">dk-order-[broj]</code>{" "}
                (sessionStorage) — iznosi vaše narudžbe, zadržani na stranici potvrde tokom trajanja sesije
                pretraživača i obrisani zatvaranjem kartice.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Analitički kolačići</h3>
            <p>
              <strong>Trenutno nisu aktivni.</strong> Nijedan analitički alat nije instaliran. Ukoliko ih
              aktiviramo u budućnosti, ažuriraćemo ovu stranicu i tražiti vaš pristanak.
            </p>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Marketing kolačići</h3>
            <p>
              <strong>Trenutno nisu aktivni.</strong> Nijedan marketinški ni reklamni alat nije instaliran.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Upravljanje postavkama</h2>
            <p>
              Možete u svakom trenutku promijeniti svoje preferencije klikom na dugme ispod ili putem linka
              „Postavke kolačića" u dnu svake stranice.
            </p>
            <button
              type="button"
              onClick={openPreferences}
              className="inline-block mt-2 px-5 py-2.5 rounded-md border border-[var(--color-copper)] text-white bg-[var(--color-copper)] hover:opacity-90 text-sm font-medium transition-opacity"
            >
              Postavke kolačića
            </button>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Usluge trećih strana</h2>
            <p>
              Koristimo Supabase za autentifikaciju, bazu podataka i pohranu fajlova. Supabase upravlja
              sesijama autentifikacije putem localStorage pretraživača, a ne HTTP kolačićima. Svi fontovi
              se učitavaju lokalno s naših servera — ne šalju se zahtjevi prema Google Fonts CDN-u niti
              bilo kojoj drugoj vanjskoj CDN usluzi fontova.
            </p>
            <p>
              Na obrascu za upite za izradu po narudžbi koristimo <strong>Cloudflare Turnstile</strong> —
              alat za zaštitu od automatizovanih slanja. Turnstile ne postavlja trajne kolačiće u vašem
              pretraživaču. Cloudflare widget učitava se s{" "}
              <code className="text-sm bg-gray-100 px-1 rounded">challenges.cloudflare.com</code> i
              obrađuje određene tehničke podatke o vašem pretraživaču i uređaju (poput tipa pretraživača i
              podataka o interakciji) kako bi procijenio je li slanje automatizovano. Ovi podaci šalju se
              Cloudflareovim serverima. Cloudflare je američka kompanija; detalji o njihovim praksama zaštite
              podataka dostupni su na{" "}
              <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="underline text-navy hover:text-copper">
                cloudflare.com/privacypolicy
              </a>.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Kontakt</h2>
            <p>
              Za pitanja u vezi s kolačićima možete nas kontaktirati putem e-maila{" "}
              <a href="mailto:info@dekokutak.ba" className="underline text-navy hover:text-copper">
                info@dekokutak.ba
              </a>.
            </p>

            <p className="text-sm text-navy/50 mt-10">
              Posljednje ažuriranje: oktobar 2026.
            </p>
          </div>
        ) : (
          <div className="prose prose-navy max-w-none space-y-6 text-navy/80 leading-relaxed">
            <p>
              This page explains how Deko Kutak uses cookies and similar browser storage technologies on{" "}
              <strong>dekokutak.ba</strong>.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">What are cookies?</h2>
            <p>
              Cookies are small text files that a website sends to your browser and stores on your device.
              In addition to cookies, websites can use <strong>localStorage</strong> and{" "}
              <strong>sessionStorage</strong> — similar technologies that store data directly in your browser
              without sending it to a server. Deko Kutak does not set HTTP cookies through application code;
              instead we use localStorage and sessionStorage to run the shop.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">What do we store in your browser?</h2>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Necessary browser storage</h3>
            <p>
              The following data is stored to make the shop work correctly:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">cart</code>{" "}
                (localStorage) — your shopping cart contents, retained until cleared
              </li>
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">lang</code>{" "}
                (localStorage) — your language preference (Bosnian or English)
              </li>
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">dk-consent</code>{" "}
                (localStorage) — your storage preference choices, retained for 365 days
              </li>
              <li>
                Supabase authentication session (localStorage) — your sign-in session, stored locally in
                your browser when you sign in or create an account. Cleared when you sign out or when the
                session expires automatically.
              </li>
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">dk-order-[number]</code>{" "}
                (sessionStorage) — your order totals, kept on the confirmation page for the duration of
                your browser session and cleared when you close the tab.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Analytics cookies</h3>
            <p>
              <strong>Currently inactive.</strong> No analytics tool is installed. If we activate analytics
              in the future, we will update this page and ask for your consent first.
            </p>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Marketing cookies</h3>
            <p>
              <strong>Currently inactive.</strong> No marketing or advertising tool is installed.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Managing your preferences</h2>
            <p>
              You can change your preferences at any time by clicking the button below or via the "Cookie
              settings" link in the footer of every page.
            </p>
            <button
              type="button"
              onClick={openPreferences}
              className="inline-block mt-2 px-5 py-2.5 rounded-md border border-[var(--color-copper)] text-white bg-[var(--color-copper)] hover:opacity-90 text-sm font-medium transition-opacity"
            >
              Cookie settings
            </button>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Third-party services</h2>
            <p>
              We use Supabase for authentication, database and file storage. Supabase manages authentication
              sessions via browser localStorage, not HTTP cookies. All fonts are self-hosted — no requests
              are made to Google Fonts or any other external font CDN.
            </p>
            <p>
              Our custom creation enquiry form uses <strong>Cloudflare Turnstile</strong> to protect against
              automated submissions. Turnstile does not set persistent cookies in your browser. The Cloudflare
              widget is loaded from{" "}
              <code className="text-sm bg-gray-100 px-1 rounded">challenges.cloudflare.com</code> and
              processes certain technical information about your browser and device (such as browser type and
              interaction data) to assess whether a submission is automated. This information is sent to
              Cloudflare's servers. Cloudflare is a US-based company; details of their data protection
              practices are available at{" "}
              <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="underline text-navy hover:text-copper">
                cloudflare.com/privacypolicy
              </a>.
            </p>

            <h2 className="text-xl font-semibold text-navy mt-8 mb-3">Contact</h2>
            <p>
              For questions about cookies, please contact us at{" "}
              <a href="mailto:info@dekokutak.ba" className="underline text-navy hover:text-copper">
                info@dekokutak.ba
              </a>.
            </p>

            <p className="text-sm text-navy/50 mt-10">Last updated: October 2026.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

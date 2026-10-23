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
              pretraživač bez slanja na server. Deko Kutak ne postavlja HTTP kolačiće putem vlastitog
              aplikacijskog koda; za rad prodavnice koristimo localStorage i sessionStorage. Kada date
              pristanak za analitiku, Google Analytics 4 postavlja vlastite HTTP kolačiće (navedeni u
              sekciji Analitički kolačići ispod).
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
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">dk-analytics-purchase-[broj]</code>{" "}
                (localStorage) — interno oznaka da je narudžba već zabilježena u analitici, sprečava
                dupliranje; postavlja se samo ako ste pristali na analitiku.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Analitički kolačići (Google Analytics 4)</h3>
            <p>
              Koristimo <strong>Google Analytics 4</strong> (Google LLC) za mjerenje posjeta i aktivnosti u
              prodavnici. Analitički skript se učitava <strong>isključivo nakon što date pristanak</strong>{" "}
              — nije prisutan ni na jednoj stranici bez vašeg pristanka.
            </p>
            <p className="mt-2">Kada je analitika aktivirana, Google Analytics prati:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Stranice koje posjećujete i proizvode koje gledate</li>
              <li>Stavke koje dodajete u korpu i dolazak do naplate</li>
              <li>Pojmove koje pretražujete u prodavnici</li>
              <li>Dovršene narudžbe (vrijednost i detalji o artiklima, bez osobnih podataka)</li>
            </ul>
            <p className="mt-2">GA4 postavlja sljedeće HTTP kolačiće u vašem pretraživaču:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">_ga</code> — razlikuje korisnike;
                istječe nakon 2 godine
              </li>
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">_ga_[ID]</code> — bilježi informacije
                o sesiji; istječe nakon 2 godine
              </li>
            </ul>
            <p className="mt-2">
              Podaci se šalju Googleovim serverima i mogu se obrađivati u SAD-u i drugim zemljama.
              Google LLC certificiran je u okviru{" "}
              <a href="https://www.dataprivacyframework.gov/" target="_blank" rel="noopener noreferrer" className="underline text-navy hover:text-copper">
                EU–US Data Privacy Framework
              </a>.
              Više informacija:{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-navy hover:text-copper">
                policies.google.com/privacy
              </a>.
            </p>
            <p className="mt-2">
              <strong>Zadržavanje podataka:</strong> Google Analytics zadržava podatke o događajima i
              korisnicima <strong>14 mjeseci</strong>, nakon čega se automatski brišu.
            </p>
            <p className="mt-2">
              Pristanak možete povući u bilo kojem trenutku klikom na dugme <em>Postavke kolačića</em>{" "}
              ispod ili u podnožju stranice. Povlačenjem pristanka zaustavljamo slanje mjernih događaja
              Googleu i brišemo GA kolačiće iz vašeg pretraživača. Već učitana GA4 skripta može
              izvršiti preostale konfiguracijske zahtjeve do ponovnog učitavanja stranice.
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
              Uz prethodni pristanak, koristimo <strong>Google Analytics 4</strong> (Google LLC) za
              analitiku. Podrobnosti su navedene u sekciji Analitički kolačići iznad. Politika privatnosti
              Googlea dostupna je na{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-navy hover:text-copper">
                policies.google.com/privacy
              </a>.
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
              without sending it to a server. Deko Kutak does not set HTTP cookies through its own
              application code — we use localStorage and sessionStorage to run the shop. When you consent
              to analytics, Google Analytics 4 sets its own HTTP cookies (listed in the Analytics section
              below).
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
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">dk-analytics-purchase-[number]</code>{" "}
                (localStorage) — an internal flag indicating an order has already been recorded in
                analytics, preventing duplicate events; only set if you have consented to analytics.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-navy mt-5 mb-2">Analytics cookies (Google Analytics 4)</h3>
            <p>
              We use <strong>Google Analytics 4</strong> (Google LLC) to measure website traffic and
              ecommerce activity. The analytics script is loaded{" "}
              <strong>only after you grant consent</strong> — it is absent from every page until consent
              is given.
            </p>
            <p className="mt-2">When analytics is enabled, Google Analytics tracks:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Pages you visit and products you view</li>
              <li>Items you add to the cart and proceed to checkout</li>
              <li>Search terms you type in the shop</li>
              <li>Completed orders (order value and product details, without personal information)</li>
            </ul>
            <p className="mt-2">GA4 sets the following HTTP cookies in your browser:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">_ga</code> — distinguishes users;
                expires after 2 years
              </li>
              <li>
                <code className="text-sm bg-gray-100 px-1 rounded">_ga_[ID]</code> — stores session
                information; expires after 2 years
              </li>
            </ul>
            <p className="mt-2">
              Data is sent to Google's servers and may be processed in the United States and other
              countries. Google LLC is certified under the{" "}
              <a href="https://www.dataprivacyframework.gov/" target="_blank" rel="noopener noreferrer" className="underline text-navy hover:text-copper">
                EU–US Data Privacy Framework
              </a>.
              For details:{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-navy hover:text-copper">
                policies.google.com/privacy
              </a>.
            </p>
            <p className="mt-2">
              <strong>Data retention:</strong> Google Analytics retains event and user data for{" "}
              <strong>14 months</strong>, after which it is automatically deleted.
            </p>
            <p className="mt-2">
              You can withdraw consent at any time by clicking <em>Cookie settings</em> below or in
              the footer. Withdrawal stops the site from sending measurement events to Google and
              deletes GA cookies from your browser. The already-loaded GA4 script may make residual
              configuration requests until the page is reloaded.
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
              With your prior consent, we use <strong>Google Analytics 4</strong> (Google LLC) for
              analytics. Full details are in the Analytics section above. Google's privacy policy is
              at{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-navy hover:text-copper">
                policies.google.com/privacy
              </a>.
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

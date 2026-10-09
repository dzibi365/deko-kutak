-- Admin-managed informational pages (Privacy Policy, T&C, FAQ, Shipping, etc.)

CREATE TABLE IF NOT EXISTS pages (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT        NOT NULL UNIQUE,
  title_en     TEXT,
  title_bs     TEXT,
  content_en   TEXT,
  content_bs   TEXT,
  is_published BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors may only read published pages
CREATE POLICY "public read published pages"
  ON pages FOR SELECT TO anon
  USING (is_published = true);

-- Authenticated admins can read all pages (including drafts)
CREATE POLICY "auth read all pages"
  ON pages FOR SELECT TO authenticated
  USING (true);

-- Authenticated admins can create, update, delete pages
CREATE POLICY "auth write pages"
  ON pages FOR ALL TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Seed four initial draft pages; content left empty for admin to fill
INSERT INTO pages (slug, title_en, title_bs, is_published) VALUES
  ('privacy',  'Privacy Policy',     'Politika privatnosti', false),
  ('terms',    'Terms & Conditions', 'Uvjeti korištenja',    false),
  ('faq',      'FAQ',                'Česta pitanja',        false),
  ('shipping', 'Shipping & Returns', 'Dostava i povrat',     false)
ON CONFLICT (slug) DO NOTHING;

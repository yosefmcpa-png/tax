-- ============================================================
-- Tax Solver v2 — Schema Extension
-- הוסף טבלאות לנתוני scraping ו-WhatsApp
-- הרץ אחרי schema.sql
-- ============================================================

-- --------------------------------
-- SCRAPED COMPANIES — רשם החברות
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.scraped_companies (
  company_number  TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unknown',
  registered_at   DATE,
  address         TEXT,
  directors       JSONB NOT NULL DEFAULT '[]',
  source_url      TEXT,
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name   ON public.scraped_companies USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.scraped_companies(status);

-- --------------------------------
-- SCRAPED TAX RULINGS — חוזרי מס
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.scraped_tax_rulings (
  ruling_number  TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  summary        TEXT,
  date_issued    DATE,
  category       TEXT NOT NULL DEFAULT 'general',
  source_url     TEXT,
  scraped_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rulings_title    ON public.scraped_tax_rulings USING gin(to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS idx_rulings_category ON public.scraped_tax_rulings(category);
CREATE INDEX IF NOT EXISTS idx_rulings_date     ON public.scraped_tax_rulings(date_issued DESC);

-- --------------------------------
-- SCRAPED LEGISLATION — חקיקה
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.scraped_legislation (
  law_id        TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'law' CHECK (type IN ('law', 'regulation', 'bill')),
  status        TEXT NOT NULL DEFAULT 'active',
  published_at  DATE,
  summary       TEXT,
  source_url    TEXT,
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legislation_title  ON public.scraped_legislation USING gin(to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS idx_legislation_type   ON public.scraped_legislation(type);

-- --------------------------------
-- SCRAPED COURT CASES — פסקי דין
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.scraped_court_cases (
  case_number    TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  court          TEXT NOT NULL,
  decision_date  DATE,
  summary        TEXT,
  outcome        TEXT,
  source_url     TEXT,
  scraped_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_cases_summary ON public.scraped_court_cases USING gin(to_tsvector('simple', coalesce(summary, '')));
CREATE INDEX IF NOT EXISTS idx_court_cases_court   ON public.scraped_court_cases(court);
CREATE INDEX IF NOT EXISTS idx_court_cases_date    ON public.scraped_court_cases(decision_date DESC);

-- --------------------------------
-- SCRAPER LOGS — לוג סנכרון
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.scraper_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper      TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  records      INTEGER NOT NULL DEFAULT 0,
  error_count  INTEGER NOT NULL DEFAULT 0,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraper_logs_scraper ON public.scraper_logs(scraper, created_at DESC);

-- --------------------------------
-- WHATSAPP MESSAGES — היסטוריית WhatsApp
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON public.whatsapp_messages(phone_number, created_at DESC);

-- --------------------------------
-- FULL TEXT SEARCH — הפעל עברית
-- --------------------------------
-- התקנת הרחבה לחיפוש טקסט מלא (אם לא קיים)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes לחיפוש חופשי בעברית
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm  ON public.scraped_companies USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rulings_title_trgm   ON public.scraped_tax_rulings USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_legislation_trgm     ON public.scraped_legislation USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_court_cases_trgm     ON public.scraped_court_cases USING gin(coalesce(summary, '') gin_trgm_ops);

-- --------------------------------
-- RLS — הנתונים ה-scraped פתוחים לקריאה (read-only)
-- כתיבה רק דרך service role (scrapers)
-- --------------------------------
ALTER TABLE public.scraped_companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_tax_rulings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_legislation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages   ENABLE ROW LEVEL SECURITY;

-- משתמשים מחוברים יכולים לקרוא נתוני scraping
CREATE POLICY "Authenticated users can read scraped data"
  ON public.scraped_companies   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read tax rulings"
  ON public.scraped_tax_rulings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read legislation"
  ON public.scraped_legislation FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read court cases"
  ON public.scraped_court_cases FOR SELECT USING (auth.role() = 'authenticated');

-- Scraper logs ו-WhatsApp — רק service role
CREATE POLICY "No public access to scraper_logs"
  ON public.scraper_logs FOR ALL USING (FALSE);
CREATE POLICY "No public access to whatsapp_messages"
  ON public.whatsapp_messages FOR ALL USING (FALSE);

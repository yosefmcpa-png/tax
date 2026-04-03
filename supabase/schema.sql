-- ============================================================
-- Tax Solver — Supabase Database Schema
-- הרץ את הקובץ הזה ב-Supabase SQL Editor
-- ============================================================

-- הפעל Row Level Security על כל הטבלאות
-- כל משתמש רואה רק את הנתונים שלו

-- --------------------------------
-- CASES — תיקי מס
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
  case_type   TEXT NOT NULL DEFAULT 'research' CHECK (case_type IN ('research', 'document', 'simulation')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own cases"
  ON public.cases FOR ALL
  USING (auth.uid() = user_id);

-- --------------------------------
-- CONVERSATIONS — היסטוריית שיחות
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content      TEXT NOT NULL,
  sources      JSONB NOT NULL DEFAULT '[]',
  action_type  TEXT,
  token_count  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access conversations of their cases"
  ON public.conversations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = conversations.case_id
        AND cases.user_id = auth.uid()
    )
  );

-- --------------------------------
-- DOCUMENTS — מסמכים שהועלו
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  filename         TEXT NOT NULL,
  content_preview  TEXT,          -- ראשון 500 תווים בלבד, לא המסמך המלא
  word_count       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access documents of their cases"
  ON public.documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = documents.case_id
        AND cases.user_id = auth.uid()
    )
  );

-- --------------------------------
-- AUDIT LOGS — לוג ביקורת (לא נגיש למשתמש רגיל)
-- --------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id),
  case_id        UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  action_type    TEXT NOT NULL,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  success        BOOLEAN NOT NULL DEFAULT TRUE,
  error_message  TEXT,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs — נגיש רק ל-service role (לא למשתמשים)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access to audit_logs"
  ON public.audit_logs FOR ALL
  USING (FALSE); -- Service role מעקף RLS אוטומטית

-- --------------------------------
-- INDEXES — לביצועים
-- --------------------------------
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON public.cases(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_case_id ON public.conversations(case_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- --------------------------------
-- AUTO-UPDATE updated_at TRIGGER
-- --------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

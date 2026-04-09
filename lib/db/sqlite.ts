/**
 * SQLite local database — standalone mode, zero external dependencies
 * מחליף Supabase לחלוטין במצב dev/standalone
 */
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), '.local', 'tax-solver.db')

// ensure dir exists
const dir = path.dirname(DB_PATH)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  initSchema(_db)
  return _db
}

// ── Schema ──────────────────────────────────────────────────
function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL DEFAULT 'local',
      title       TEXT NOT NULL,
      case_type   TEXT NOT NULL DEFAULT 'research',
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      case_id     TEXT NOT NULL,
      role        TEXT NOT NULL,
      content     TEXT NOT NULL,
      sources     TEXT NOT NULL DEFAULT '[]',
      action_type TEXT,
      token_count INTEGER,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL DEFAULT 'local',
      case_id       TEXT,
      action_type   TEXT NOT NULL,
      input_tokens  INTEGER,
      output_tokens INTEGER,
      success       INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scraped_companies (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      status     TEXT,
      type       TEXT,
      registered TEXT,
      raw        TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scraped_legislation (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      type        TEXT,
      status      TEXT,
      summary     TEXT,
      source_url  TEXT,
      published_at TEXT,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scraped_court_cases (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      court         TEXT,
      decision_date TEXT,
      summary       TEXT,
      source_url    TEXT,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scraped_tax_rulings (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      category     TEXT,
      date_issued  TEXT,
      summary      TEXT,
      source_url   TEXT,
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scraper_logs (
      id         TEXT PRIMARY KEY,
      source     TEXT NOT NULL,
      status     TEXT NOT NULL,
      records    INTEGER DEFAULT 0,
      error      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

// ── CRUD helpers ─────────────────────────────────────────────

export function createCase(title: string, caseType = 'research') {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO cases (id, title, case_type) VALUES (?, ?, ?)
  `).run(id, title, caseType)
  return { id, title, case_type: caseType }
}

export function saveConversation(opts: {
  caseId:     string
  role:       string
  content:    string
  sources?:   object[]
  actionType?: string
}) {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO conversations (id, case_id, role, content, sources, action_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    opts.caseId,
    opts.role,
    opts.content,
    JSON.stringify(opts.sources ?? []),
    opts.actionType ?? null,
  )
  return id
}

export function getConversations(caseId: string) {
  return getDb()
    .prepare('SELECT * FROM conversations WHERE case_id = ? ORDER BY created_at')
    .all(caseId) as Array<{
      id: string; case_id: string; role: string; content: string
      sources: string; action_type: string; created_at: string
    }>
}

export function logAction(opts: {
  userId?: string; caseId?: string; actionType: string
  inputTokens?: number; outputTokens?: number
  success?: boolean; errorMessage?: string
}) {
  const db = getDb()
  db.prepare(`
    INSERT INTO agent_logs (id, user_id, case_id, action_type, input_tokens, output_tokens, success, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    opts.userId ?? 'local',
    opts.caseId ?? null,
    opts.actionType,
    opts.inputTokens ?? null,
    opts.outputTokens ?? null,
    opts.success !== false ? 1 : 0,
    opts.errorMessage ?? null,
  )
}

// ── In-memory rate limit ─────────────────────────────────────
const _rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = _rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    _rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

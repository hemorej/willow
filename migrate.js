// Schema bootstrap, run once at server start (see server.js `start()`).
// Idempotent: every statement is CREATE TABLE / INDEX / ADD COLUMN ... IF NOT
// EXISTS, so it doubles as the (forward-only) migration mechanism — add new
// DDL here rather than maintaining separate migration files.

const pool = require('./db');

/** Create/upgrade all tables and indexes. Safe to call repeatedly. */
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Renamed from bdi_results when PHQ-9+ replaced the BDI-II.
    DO $$ BEGIN
      IF to_regclass('bdi_results') IS NOT NULL AND to_regclass('assessment_results') IS NULL THEN
        ALTER TABLE bdi_results RENAME TO assessment_results;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS assessment_results (
      id TEXT PRIMARY KEY,
      taken_at TIMESTAMPTZ NOT NULL,
      total_score INTEGER NOT NULL,
      severity TEXT,
      note TEXT,
      data JSONB NOT NULL
    );

    -- Existing rows are BDI-II; new check-ins are written as 'phq9x'.
    ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS instrument TEXT NOT NULL DEFAULT 'bdi2';

    CREATE TABLE IF NOT EXISTS cbt_entries (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      entry_date DATE NOT NULL,
      entry_order BIGINT NOT NULL,
      mood SMALLINT,
      body TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS journal_entries_date_order_idx
      ON journal_entries (entry_date DESC, entry_order DESC);

    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS gratitude BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS gratitude_tag TEXT;

    CREATE TABLE IF NOT EXISTS journal_followups (
      id SERIAL PRIMARY KEY,
      shown_date DATE NOT NULL,
      theme TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      entry_id TEXT REFERENCES journal_entries(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { initDb };

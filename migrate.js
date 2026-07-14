const pool = require('./db');

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bdi_results (
      id TEXT PRIMARY KEY,
      taken_at TIMESTAMPTZ NOT NULL,
      total_score INTEGER NOT NULL,
      severity TEXT,
      note TEXT,
      data JSONB NOT NULL
    );

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
  `);
}

module.exports = { initDb };

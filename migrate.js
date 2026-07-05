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
  `);
}

module.exports = { initDb };

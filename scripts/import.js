#!/usr/bin/env node
/**
 * One-time migration: import existing JSON files from results/ into PostgreSQL.
 * Usage: DATABASE_URL=... node scripts/import.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { initDb } = require('../migrate');

const RESULTS_DIR = path.join(__dirname, '..', 'results');
const CBT_DIR = path.join(RESULTS_DIR, 'cbt');

async function importBdi() {
  if (!fs.existsSync(RESULTS_DIR)) {
    console.log('No results/ directory found — skipping BDI-II import.');
    return;
  }

  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.startsWith('bdi2-') && f.endsWith('.json'));
  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8'));
      const id = record.id || file.replace(/\.json$/, '');
      const { rowCount } = await pool.query(
        `INSERT INTO bdi_results (id, taken_at, total_score, severity, note, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [id, record.takenAt, record.totalScore, record.severity || null, record.note || null, record]
      );
      rowCount ? imported++ : skipped++;
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  console.log(`BDI-II: ${imported} imported, ${skipped} already present.`);
}

async function importCbt() {
  if (!fs.existsSync(CBT_DIR)) {
    console.log('No results/cbt/ directory found — skipping CBT import.');
    return;
  }

  const CBT_SAFE = /^thought-record-[0-9A-Za-z\-]+\.json$/;
  const files = fs.readdirSync(CBT_DIR).filter((f) => CBT_SAFE.test(f));
  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(CBT_DIR, file), 'utf8'));
      const savedAt = record.savedAt || new Date().toISOString();
      const { rowCount } = await pool.query(
        `INSERT INTO cbt_entries (filename, saved_at, data)
         VALUES ($1, $2, $3)
         ON CONFLICT (filename) DO NOTHING`,
        [file, savedAt, record]
      );
      rowCount ? imported++ : skipped++;
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  console.log(`CBT: ${imported} imported, ${skipped} already present.`);
}

async function main() {
  console.log('Connecting to:', process.env.DATABASE_URL || 'postgres://localhost/bdi2');
  await initDb();
  await importBdi();
  await importCbt();
  await pool.end();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });

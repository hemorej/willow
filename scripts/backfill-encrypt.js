#!/usr/bin/env node
/**
 * Backfill: encrypts any journal entries, followup answers, check-in results
 * and CBT records still in plaintext (i.e. written before they were encrypted).
 * Runs in one transaction. Safe to re-run: encrypted values are left untouched.
 *
 * Usage: DATABASE_URL=... JOURNAL_ENC_KEY=... node scripts/backfill-encrypt.js
 */

require('dotenv').config({ quiet: true });
const pool = require('../db');
const { initDb } = require('../migrate');
const journalCrypto = require('../lib/journal-crypto');
const { encryptRows } = require('../lib/encrypt-rows');

async function main() {
  if (!journalCrypto.ENCRYPTION_ENABLED) {
    console.error('JOURNAL_ENC_KEY is not set — nothing to encrypt with.');
    process.exit(1);
  }

  await initDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await encryptRows(client, journalCrypto.isEnvelope);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

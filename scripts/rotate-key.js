#!/usr/bin/env node
/**
 * Rewraps every encrypted value (see lib/encrypt-rows.js) from the previous
 * encryption key onto the current one, in a single transaction.
 * Run this once, right after bumping JOURNAL_ENC_KEY_VERSION and moving the
 * old key/version into JOURNAL_ENC_KEY_PREV/_VERSION.
 *
 * Usage:
 *   DATABASE_URL=... \
 *   JOURNAL_ENC_KEY=<new key, hex>       JOURNAL_ENC_KEY_VERSION=<new version> \
 *   JOURNAL_ENC_KEY_PREV=<old key, hex>  JOURNAL_ENC_KEY_PREV_VERSION=<old version> \
 *   node scripts/rotate-key.js
 *
 * Afterwards: verify entries, check-ins and CBT records read back, then remove
 * JOURNAL_ENC_KEY_PREV(_VERSION) from the environment and destroy the old key.
 */

const pool = require('../db');
const { initDb } = require('../migrate');
const journalCrypto = require('../lib/journal-crypto');
const { encryptRows } = require('../lib/encrypt-rows');

async function main() {
  if (!process.env.JOURNAL_ENC_KEY_PREV || !process.env.JOURNAL_ENC_KEY_PREV_VERSION) {
    console.error('Set JOURNAL_ENC_KEY_PREV and JOURNAL_ENC_KEY_PREV_VERSION to the key/version being rotated out.');
    process.exit(1);
  }
  if (!journalCrypto.ENCRYPTION_ENABLED) {
    console.error('JOURNAL_ENC_KEY (the new key) is not set.');
    process.exit(1);
  }

  const targetVersion = journalCrypto.CURRENT_VERSION;
  await initDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await encryptRows(client, (value) => Boolean(value?.startsWith(`v${targetVersion}:`)));
    await client.query('COMMIT');

    console.log('Verify entries, check-ins and CBT records load correctly, then drop JOURNAL_ENC_KEY_PREV(_VERSION) and destroy the old key.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

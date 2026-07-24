#!/usr/bin/env node
/**
 * Rewraps every journal_entries row and journal_followups.answer from the
 * previous encryption key onto the current one, in a single transaction.
 * Run this once, right after bumping JOURNAL_ENC_KEY_VERSION and moving the
 * old key/version into JOURNAL_ENC_KEY_PREV/_VERSION.
 *
 * Usage:
 *   DATABASE_URL=... \
 *   JOURNAL_ENC_KEY=<new key, hex>       JOURNAL_ENC_KEY_VERSION=<new version> \
 *   JOURNAL_ENC_KEY_PREV=<old key, hex>  JOURNAL_ENC_KEY_PREV_VERSION=<old version> \
 *   node scripts/rotate-key.js
 *
 * Afterwards: verify a few rows read back correctly, then remove
 * JOURNAL_ENC_KEY_PREV(_VERSION) from the environment and destroy the old key.
 */

const pool = require('../db');
const journalCrypto = require('../lib/journal-crypto');

async function rotateJournalEntries(client, targetVersion) {
  const { rows } = await client.query('SELECT id, body, data FROM journal_entries');
  let rewrapped = 0;
  let alreadyCurrent = 0;

  for (const row of rows) {
    const bodyIsCurrent = row.body === null || row.body.startsWith(`v${targetVersion}:`);
    const dataIsCurrent = row.data === null || (typeof row.data.enc === 'string' && row.data.enc.startsWith(`v${targetVersion}:`));

    if (bodyIsCurrent && dataIsCurrent) {
      alreadyCurrent++;
      continue;
    }

    // decryptText/decryptJSON pick the right key by reading the version tag
    // off each envelope, then we re-encrypt under the new current version
    // with a fresh IV.
    const plainBody = journalCrypto.decryptText(row.body);
    const plainData = journalCrypto.decryptJSON(row.data);
    const newBody = journalCrypto.encryptText(plainBody, targetVersion);
    const newData = journalCrypto.encryptJSON(plainData, targetVersion);

    await client.query('UPDATE journal_entries SET body = $1, data = $2 WHERE id = $3', [newBody, newData, row.id]);
    rewrapped++;
  }

  console.log(`journal_entries: rewrapped ${rewrapped} row(s) onto key version ${targetVersion}; ${alreadyCurrent} already current.`);
}

async function rotateJournalFollowups(client, targetVersion) {
  const { rows } = await client.query('SELECT id, answer FROM journal_followups WHERE answer IS NOT NULL');
  let rewrapped = 0;
  let alreadyCurrent = 0;

  for (const row of rows) {
    if (row.answer.startsWith(`v${targetVersion}:`)) {
      alreadyCurrent++;
      continue;
    }

    const plainAnswer = journalCrypto.decryptText(row.answer);
    const newAnswer = journalCrypto.encryptText(plainAnswer, targetVersion);
    await client.query('UPDATE journal_followups SET answer = $1 WHERE id = $2', [newAnswer, row.id]);
    rewrapped++;
  }

  console.log(`journal_followups: rewrapped ${rewrapped} row(s) onto key version ${targetVersion}; ${alreadyCurrent} already current.`);
}

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await rotateJournalEntries(client, targetVersion);
    await rotateJournalFollowups(client, targetVersion);
    await client.query('COMMIT');

    console.log('Verify a few entries load correctly, then drop JOURNAL_ENC_KEY_PREV(_VERSION) and destroy the old key.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

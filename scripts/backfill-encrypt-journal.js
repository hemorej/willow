#!/usr/bin/env node
/**
 * One-time backfill: encrypts any journal_entries (body/data) and
 * journal_followups (answer) rows still in plaintext (i.e. written before
 * JOURNAL_ENC_KEY was introduced). Safe to re-run — rows already in envelope
 * format are left untouched.
 *
 * Usage: DATABASE_URL=... JOURNAL_ENC_KEY=... node scripts/backfill-encrypt-journal.js
 */

const pool = require('../db');
const journalCrypto = require('../lib/journal-crypto');

async function backfillJournalEntries(client) {
  const { rows } = await client.query('SELECT id, body, data FROM journal_entries');
  let encrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    const bodyAlreadyEncrypted = row.body === null || journalCrypto.isEnvelope(row.body);
    const dataAlreadyEncrypted = row.data === null || (typeof row.data === 'object' && typeof row.data.enc === 'string');

    if (bodyAlreadyEncrypted && dataAlreadyEncrypted) {
      skipped++;
      continue;
    }

    const newBody = bodyAlreadyEncrypted ? row.body : journalCrypto.encryptText(row.body);
    const newData = dataAlreadyEncrypted ? row.data : journalCrypto.encryptJSON(row.data);
    await client.query('UPDATE journal_entries SET body = $1, data = $2 WHERE id = $3', [newBody, newData, row.id]);
    encrypted++;
  }

  console.log(`journal_entries: encrypted ${encrypted} row(s), ${skipped} already encrypted.`);
}

async function backfillJournalFollowups(client) {
  const { rows } = await client.query('SELECT id, answer FROM journal_followups WHERE answer IS NOT NULL');
  let encrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (journalCrypto.isEnvelope(row.answer)) {
      skipped++;
      continue;
    }

    await client.query('UPDATE journal_followups SET answer = $1 WHERE id = $2', [journalCrypto.encryptText(row.answer), row.id]);
    encrypted++;
  }

  console.log(`journal_followups: encrypted ${encrypted} row(s), ${skipped} already encrypted.`);
}

async function main() {
  if (!journalCrypto.ENCRYPTION_ENABLED) {
    console.error('JOURNAL_ENC_KEY is not set — nothing to encrypt with.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await backfillJournalEntries(client);
    await backfillJournalFollowups(client);
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

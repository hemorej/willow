#!/usr/bin/env node
/**
 * One-time backfill: encrypts any journal_entries rows whose body/data are
 * still plaintext (i.e. written before JOURNAL_ENC_KEY was introduced).
 * Safe to re-run — rows already in envelope format are left untouched.
 *
 * Usage: DATABASE_URL=... JOURNAL_ENC_KEY=... node scripts/backfill-encrypt-journal.js
 */

const pool = require('../db');
const journalCrypto = require('../lib/journal-crypto');

async function main() {
  if (!journalCrypto.ENCRYPTION_ENABLED) {
    console.error('JOURNAL_ENC_KEY is not set — nothing to encrypt with.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT id, body, data FROM journal_entries');
    let encrypted = 0;
    let skipped = 0;

    await client.query('BEGIN');
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
    await client.query('COMMIT');

    console.log(`Encrypted ${encrypted} row(s), ${skipped} already encrypted.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

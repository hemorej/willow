// Bulk (re-)encryption of every encrypted column, shared by
// scripts/backfill-encrypt.js and scripts/rotate-key.js. A new encrypted
// column must be listed here, or a key rotation will strand it under the old key.

const journalCrypto = require('./journal-crypto');

const TABLES = [
  { table: 'journal_entries', text: ['body'], json: ['data'] },
  { table: 'journal_followups', text: ['answer'], json: [] },
  { table: 'assessment_results', text: ['severity', 'note'], json: ['data'], score: 'total_score' },
  { table: 'cbt_entries', text: [], json: ['data'] }
];

/**
 * Re-encrypt, under the current key, each value that `isDone` rejects. A
 * plaintext score is moved into `data` and its column cleared. Must run inside
 * a transaction: rows stay locked until it ends.
 *
 * @param {import('pg').PoolClient} client
 * @param {(stored: string) => boolean} isDone True if a stored string needs no work.
 */
async function encryptRows(client, isDone) {
  for (const { table, text, json, score } of TABLES) {
    const columns = ['id', ...text, ...json, ...(score ? [score] : [])];
    const { rows } = await client.query(`SELECT ${columns.join(', ')} FROM ${table} FOR UPDATE`);
    let changed = 0;

    for (const row of rows) {
      const updates = {};
      for (const col of text) {
        if (row[col] !== null && !isDone(row[col])) {
          updates[col] = journalCrypto.encryptText(journalCrypto.decryptText(row[col]));
        }
      }
      for (const col of json) {
        const moveScore = Boolean(score) && row[score] !== null;
        const done = journalCrypto.isWrapper(row[col]) && isDone(row[col].enc);
        if (row[col] === null || (done && !moveScore)) continue;
        let value = journalCrypto.decryptJSON(row[col]);
        if (moveScore) {
          value = { ...value, totalScore: row[score] };
          updates[score] = null;
        }
        updates[col] = journalCrypto.encryptJSON(value);
      }

      const names = Object.keys(updates);
      if (!names.length) continue;
      const assignments = names.map((name, i) => `${name} = $${i + 1}`).join(', ');
      await client.query(
        `UPDATE ${table} SET ${assignments} WHERE id = $${names.length + 1}`,
        [...names.map((name) => updates[name]), row.id]
      );
      changed++;
    }

    console.log(`${table}: encrypted ${changed} row(s), ${rows.length - changed} unchanged.`);
  }
}

module.exports = { encryptRows };

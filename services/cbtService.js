// Persistence for CBT thought records ("thought-record-<iso>.json"). The
// `.json` filename is a historical artefact from a file-backed version; it is
// now just the primary key of the cbt_entries row.

const pool = require('../db');

// Guards the :filename route param before it hits a query.
const CBT_SAFE_FILENAME = /^thought-record-[0-9A-Za-z\-]+\.json$/;

/**
 * Build a one-line, <=140-char preview of a thought record for the list view,
 * using the first non-empty of situation / automatic thought / adaptive response.
 *
 * @param {object} record
 * @returns {string}
 */
function cbtSummarize(record) {
  const candidates = [record.situation, record.automaticThought, record.adaptiveResponse];
  const first = candidates.find((v) => v && String(v).trim());
  const text = first ? String(first).trim() : '(no description)';
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length > 140 ? oneLine.slice(0, 137) + '…' : oneLine;
}

/**
 * Persist a submitted thought record. A `savedAt` timestamp is added server-side.
 *
 * @param {object} body Arbitrary thought-record fields from the client
 * @returns {Promise<{filename: string}>}
 */
async function submit(body) {
  const now = new Date();
  const filename = `thought-record-${now.toISOString().replace(/[:.]/g, '-')}.json`;
  const record = { savedAt: now.toISOString(), ...body };

  await pool.query(
    'INSERT INTO cbt_entries (filename, saved_at, data) VALUES ($1, $2, $3)',
    [filename, record.savedAt, record]
  );

  return { filename };
}

/**
 * List all thought records newest-first, each reduced to summary fields for
 * the list view (full record is fetched separately via getEntry).
 *
 * @returns {Promise<Array<object>>}
 */
async function listEntries() {
  const { rows } = await pool.query(
    'SELECT filename, saved_at, data FROM cbt_entries ORDER BY saved_at DESC'
  );
  return rows.map((r) => ({
    filename: r.filename,
    savedAt: r.saved_at,
    datetime: r.data.datetime || null,
    summary: cbtSummarize(r.data),
    emotion: r.data.emotion || null,
    emotionIntensity: typeof r.data.emotionIntensity === 'number' ? r.data.emotionIntensity : null
  }));
}

/**
 * Fetch a single thought record's full JSONB data.
 *
 * @param {string} filename
 * @returns {Promise<{invalid: true} | {notFound: true} | {record: object}>}
 */
async function getEntry(filename) {
  if (!CBT_SAFE_FILENAME.test(filename)) return { invalid: true };
  const { rows } = await pool.query('SELECT data FROM cbt_entries WHERE filename = $1', [filename]);
  if (!rows.length) return { notFound: true };
  return { record: rows[0].data };
}

module.exports = { submit, listEntries, getEntry, CBT_SAFE_FILENAME };

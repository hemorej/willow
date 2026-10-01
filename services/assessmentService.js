// Persistence for depression self-report check-ins (`assessment_results`).
// Each result is stored both as flat columns (for listing/sorting) and as a
// full JSONB `data` record (for the detail view). Two instruments exist:
//   - `phq9x`: current — PHQ-9 plus 4 extra items, 13 items, max 39
//   - `bdi2`:  archive — legacy BDI-II rows, read-only (never written here)

const pool = require('../db');

const CURRENT_INSTRUMENT = 'phq9x';
const PHQ9X_MAX_SCORE = 39;

// Guards the :id route param before it hits a query — ids are always
// "<instrument>-<iso timestamp with : and . replaced by ->".
const ASSESSMENT_SAFE_ID = /^(bdi2|phq9x)-[0-9A-Za-z\-]+$/;

/**
 * Score and persist a submitted questionnaire (always the current instrument).
 *
 * @param {{answers: Array<{score?: number}>, severity?: string, note?: string}} body
 * @returns {Promise<{id: string, totalScore: number}>}
 */
async function createResult(body) {
  const now = new Date();
  const iso = now.toISOString();
  const id = `${CURRENT_INSTRUMENT}-${iso.replace(/[:.]/g, '-')}`;
  const totalScore = body.answers.reduce((sum, a) => sum + (Number(a && a.score) || 0), 0);

  const record = {
    id,
    instrument: CURRENT_INSTRUMENT,
    takenAt: iso,
    totalScore,
    severity: body.severity || null,
    answers: body.answers,
    note: body.note || null,
    meta: { questionCount: body.answers.length, maxPossibleScore: PHQ9X_MAX_SCORE }
  };

  await pool.query(
    `INSERT INTO assessment_results (id, instrument, taken_at, total_score, severity, note, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, CURRENT_INSTRUMENT, iso, totalScore, body.severity || null, body.note || null, record]
  );

  return { id, totalScore };
}

/**
 * List all results newest-first, without the full answer payload.
 *
 * @returns {Promise<Array<{id: string, instrument: string, takenAt: Date, totalScore: number, severity: string|null, note: string|null}>>}
 */
async function listResults() {
  const { rows } = await pool.query(
    'SELECT id, instrument, taken_at, total_score, severity, note FROM assessment_results ORDER BY taken_at DESC'
  );
  return rows.map((r) => ({
    id: r.id,
    instrument: r.instrument,
    takenAt: r.taken_at,
    totalScore: r.total_score,
    severity: r.severity,
    note: r.note
  }));
}

/**
 * Fetch a single result's full JSONB record.
 *
 * @param {string} id
 * @returns {Promise<{invalid: true} | {notFound: true} | {data: object}>}
 */
async function getResult(id) {
  if (!ASSESSMENT_SAFE_ID.test(id)) return { invalid: true };
  const { rows } = await pool.query('SELECT instrument, data FROM assessment_results WHERE id = $1', [id]);
  if (!rows.length) return { notFound: true };
  return { data: { instrument: rows[0].instrument, ...rows[0].data } };
}

module.exports = { createResult, listResults, getResult, ASSESSMENT_SAFE_ID, CURRENT_INSTRUMENT };

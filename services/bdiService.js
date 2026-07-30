const pool = require('../db');

const BDI_SAFE_ID = /^bdi2-[0-9A-Za-z\-]+$/;

async function createResult(body) {
  const now = new Date();
  const iso = now.toISOString();
  const id = `bdi2-${iso.replace(/[:.]/g, '-')}`;
  const totalScore = body.answers.reduce((sum, a) => sum + (Number(a && a.score) || 0), 0);

  const record = {
    id,
    takenAt: iso,
    totalScore,
    severity: body.severity || null,
    answers: body.answers,
    note: body.note || null,
    meta: { questionCount: body.answers.length, skippedQuestion9: true, maxPossibleScore: 60 }
  };

  await pool.query(
    'INSERT INTO bdi_results (id, taken_at, total_score, severity, note, data) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, iso, totalScore, body.severity || null, body.note || null, record]
  );

  return { id, totalScore };
}

async function listResults() {
  const { rows } = await pool.query(
    'SELECT id, taken_at, total_score, severity, note FROM bdi_results ORDER BY taken_at DESC'
  );
  return rows.map((r) => ({
    id: r.id,
    takenAt: r.taken_at,
    totalScore: r.total_score,
    severity: r.severity,
    note: r.note
  }));
}

async function getResult(id) {
  if (!BDI_SAFE_ID.test(id)) return { invalid: true };
  const { rows } = await pool.query('SELECT data FROM bdi_results WHERE id = $1', [id]);
  if (!rows.length) return { notFound: true };
  return { data: rows[0].data };
}

module.exports = { createResult, listResults, getResult, BDI_SAFE_ID };

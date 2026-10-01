const assessmentService = require('../services/assessmentService');
const { getLogger } = require('../lib/logger');

const logger = getLogger('assessment');

/** POST /api/results — validate the `answers` array, score it, persist. Returns `{ ok, id, totalScore }`. */
async function submitResult(req, res) {
  const body = req.body || {};
  if (!Array.isArray(body.answers)) {
    return res.status(400).json({ error: 'answers array is required' });
  }
  try {
    const { id, totalScore } = await assessmentService.createResult(body);
    logger.info('assessment.result_saved', { requestId: req.id, resultId: id });
    res.json({ ok: true, id, totalScore });
  } catch (err) {
    logger.error('assessment.result_save_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to save result' });
  }
}

/** GET /api/results — summary list, newest first. */
async function listResults(req, res) {
  try {
    const results = await assessmentService.listResults();
    res.json({ results });
  } catch (err) {
    logger.error('assessment.list_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to read results' });
  }
}

/** GET /api/results/:id — full record; 400 on a malformed id, 404 if absent. */
async function getResult(req, res) {
  try {
    const result = await assessmentService.getResult(req.params.id);
    if (result.invalid) return res.status(400).json({ error: 'Invalid id' });
    if (result.notFound) return res.status(404).json({ error: 'Not found' });
    res.json(result.data);
  } catch (err) {
    logger.error('assessment.get_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to read result' });
  }
}

module.exports = { submitResult, listResults, getResult };

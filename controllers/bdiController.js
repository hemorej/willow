const bdiService = require('../services/bdiService');
const { getLogger } = require('../lib/logger');

const logger = getLogger('bdi');

async function submitResult(req, res) {
  const body = req.body || {};
  if (!Array.isArray(body.answers)) {
    return res.status(400).json({ error: 'answers array is required' });
  }
  try {
    const { id, totalScore } = await bdiService.createResult(body);
    logger.info('bdi.result_saved', { requestId: req.id, resultId: id });
    res.json({ ok: true, id, totalScore });
  } catch (err) {
    logger.error('bdi.result_save_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to save result' });
  }
}

async function listResults(req, res) {
  try {
    const results = await bdiService.listResults();
    res.json({ results });
  } catch (err) {
    logger.error('bdi.list_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to read results' });
  }
}

async function getResult(req, res) {
  try {
    const result = await bdiService.getResult(req.params.id);
    if (result.invalid) return res.status(400).json({ error: 'Invalid id' });
    if (result.notFound) return res.status(404).json({ error: 'Not found' });
    res.json(result.data);
  } catch (err) {
    logger.error('bdi.get_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to read result' });
  }
}

module.exports = { submitResult, listResults, getResult };

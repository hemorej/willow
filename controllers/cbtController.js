const cbtService = require('../services/cbtService');
const { getLogger } = require('../lib/logger');

const logger = getLogger('cbt');

/** POST /api/cbt/submit — persist a thought record. Returns `{ ok, filename }`. */
async function submit(req, res) {
  try {
    const { filename } = await cbtService.submit(req.body || {});
    logger.info('cbt.entry_saved', { requestId: req.id, filename });
    res.json({ ok: true, filename });
  } catch (err) {
    logger.error('cbt.entry_save_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ ok: false, error: 'Failed to save record' });
  }
}

/** GET /api/cbt/entries — summary list, newest first. */
async function listEntries(req, res) {
  try {
    const entries = await cbtService.listEntries();
    res.json({ ok: true, entries });
  } catch (err) {
    logger.error('cbt.list_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ ok: false, error: 'Failed to read entries' });
  }
}

/** GET /api/cbt/entries/:filename — full record; 400 on a malformed filename, 404 if absent. */
async function getEntry(req, res) {
  try {
    const result = await cbtService.getEntry(req.params.filename);
    if (result.invalid) return res.status(400).json({ ok: false, error: 'Invalid filename' });
    if (result.notFound) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, filename: req.params.filename, record: result.record });
  } catch (err) {
    logger.error('cbt.get_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ ok: false, error: 'Failed to read entry' });
  }
}

module.exports = { submit, listEntries, getEntry };

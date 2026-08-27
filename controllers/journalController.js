const journalService = require('../services/journalService');
const { getLogger } = require('../lib/logger');

const logger = getLogger('journal');

/** POST /api/journal/entries — create an entry (and record any followup answer). 400 on validation error. */
async function createEntry(req, res) {
  try {
    const result = await journalService.createEntry(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    logger.info('journal.entry_saved', { requestId: req.id, entryId: result.entry.id });
    res.json({ ok: true, entry: result.entry });
  } catch (err) {
    logger.error('journal.entry_save_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to save entry' });
  }
}

/** GET /api/journal/entries — all entries, newest first, decrypted. */
async function listEntries(req, res) {
  try {
    const entries = await journalService.listEntries();
    res.json({ ok: true, entries });
  } catch (err) {
    logger.error('journal.list_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ ok: false, error: 'Failed to read entries' });
  }
}

/** PATCH /api/journal/entries/:id — replace the entry's text. 400 if empty, 404 if absent. */
async function updateEntry(req, res) {
  const body = req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Text cannot be empty' });

  try {
    const result = await journalService.updateEntry(req.params.id, text);
    if (result.notFound) return res.status(404).json({ error: 'Entry not found' });
    logger.info('journal.entry_updated', { requestId: req.id, entryId: req.params.id });
    res.json({ ok: true, text: result.text });
  } catch (err) {
    logger.error('journal.entry_update_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to update entry' });
  }
}

/** POST /api/journal/followup-check — `{ date }` in; `{ show, ... }` describing whether/which followup prompt to display. */
async function followupCheck(req, res) {
  try {
    const result = await journalService.checkFollowup(req.body?.date);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    logger.error('journal.followup_check_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to check followup eligibility' });
  }
}

module.exports = { createEntry, listEntries, updateEntry, followupCheck };

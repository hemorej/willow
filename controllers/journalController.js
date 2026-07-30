const journalService = require('../services/journalService');

async function createEntry(req, res) {
  try {
    const result = await journalService.createEntry(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true, entry: result.entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save entry' });
  }
}

async function listEntries(_req, res) {
  try {
    const entries = await journalService.listEntries();
    res.json({ ok: true, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read entries' });
  }
}

async function updateEntry(req, res) {
  const body = req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Text cannot be empty' });

  try {
    const result = await journalService.updateEntry(req.params.id, text);
    if (result.notFound) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true, text: result.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update entry' });
  }
}

async function followupCheck(req, res) {
  try {
    const result = await journalService.checkFollowup(req.body?.date);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check followup eligibility' });
  }
}

module.exports = { createEntry, listEntries, updateEntry, followupCheck };

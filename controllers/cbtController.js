const cbtService = require('../services/cbtService');

async function submit(req, res) {
  try {
    const { filename } = await cbtService.submit(req.body || {});
    res.json({ ok: true, filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to save record' });
  }
}

async function listEntries(_req, res) {
  try {
    const entries = await cbtService.listEntries();
    res.json({ ok: true, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read entries' });
  }
}

async function getEntry(req, res) {
  try {
    const result = await cbtService.getEntry(req.params.filename);
    if (result.invalid) return res.status(400).json({ ok: false, error: 'Invalid filename' });
    if (result.notFound) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, filename: req.params.filename, record: result.record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read entry' });
  }
}

module.exports = { submit, listEntries, getEntry };

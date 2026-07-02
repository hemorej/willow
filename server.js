/**
 * Local Express server for the BDI-II quiz app and CBT thought record tool.
 *
 * Run with: node server.js
 * Then open: http://localhost:3000
 *
 * Routes:
 *   POST /api/results            — save a BDI-II quiz submission
 *   GET  /api/results            — list all past BDI-II results (summary)
 *   GET  /api/results/:id        — fetch a single BDI-II result (full JSON)
 *   POST /api/cbt/submit         — save a CBT thought record
 *   GET  /api/cbt/entries        — list all past CBT entries (summary)
 *   GET  /api/cbt/entries/:file  — fetch a single CBT entry (full JSON)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const RESULTS_DIR = path.join(__dirname, 'results');
const CBT_DIR = path.join(RESULTS_DIR, 'cbt');

// Make sure the results folders exist
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}
if (!fs.existsSync(CBT_DIR)) {
  fs.mkdirSync(CBT_DIR, { recursive: true });
}

// Filename safety for CBT thought records: only our generated pattern, no path separators.
const CBT_SAFE_FILENAME = /^thought-record-[0-9A-Za-z\-]+\.json$/;

/**
 * Returns a one-line preview of a CBT thought record (≤ 140 chars).
 * Tries situation → automaticThought → adaptiveResponse in order.
 * @param {object} record - Parsed CBT thought-record JSON.
 * @returns {string}
 */
function cbtSummarize(record) {
  const candidates = [record.situation, record.automaticThought, record.adaptiveResponse];
  const first = candidates.find((v) => v && String(v).trim());
  const text = first ? String(first).trim() : '(no description)';
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length > 140 ? oneLine.slice(0, 137) + '…' : oneLine;
}

// Serve minified production assets from dist/ if they've been built
// (pnpm run build), otherwise fall back to the raw files in public/.
const DIST_DIR = path.join(__dirname, 'dist');
const STATIC_DIR = fs.existsSync(DIST_DIR)
  ? DIST_DIR
  : path.join(__dirname, 'public');

app.use(express.json({ limit: '256kb' }));
app.use(express.static(STATIC_DIR, { maxAge: '1d' }));

// Save a completed quiz result as a JSON file in ./results/
app.post('/api/results', (req, res) => {
  try {
    const body = req.body || {};
    if (!Array.isArray(body.answers)) {
      return res.status(400).json({ error: 'answers array is required' });
    }

    const now = new Date();
    const iso = now.toISOString();
    // Filename uses the timestamp so files sort naturally on disk.
    const safeStamp = iso.replace(/[:.]/g, '-');
    const filename = `bdi2-${safeStamp}.json`;
    const filePath = path.join(RESULTS_DIR, filename);

    const totalScore = body.answers.reduce(
      (sum, a) => sum + (Number(a && a.score) || 0),
      0
    );

    const record = {
      id: filename.replace(/\.json$/, ''),
      takenAt: iso,
      totalScore,
      severity: body.severity || null,
      answers: body.answers,
      note: body.note || null,
      meta: {
        questionCount: body.answers.length,
        skippedQuestion9: true,
        maxPossibleScore: 60
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    res.json({ ok: true, id: record.id, file: filename, totalScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// List past results sorted by takenAt descending.
app.get('/api/results', (_req, res) => {
  try {
    const files = fs
      .readdirSync(RESULTS_DIR)
      .filter((f) => f.endsWith('.json'));

    const items = files
      .map((f) => {
        try {
          const raw = fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8');
          const data = JSON.parse(raw);
          return {
            id: data.id || f.replace(/\.json$/, ''),
            file: f,
            takenAt: data.takenAt,
            totalScore: data.totalScore,
            severity: data.severity
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));

    res.json({ results: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read results' });
  }
});

// Get a single result's full JSON.
app.get('/api/results/:id', (req, res) => {
  try {
    const id = req.params.id.replace(/[^a-zA-Z0-9_\-]/g, '');
    const filePath = path.join(RESULTS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    res.type('application/json').send(raw);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read result' });
  }
});

// Save a completed CBT thought record as a JSON file in ./results/cbt/
app.post('/api/cbt/submit', (req, res) => {
  try {
    const body = req.body || {};
    const safeStamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `thought-record-${safeStamp}.json`;
    const filePath = path.join(CBT_DIR, filename);
    const record = { savedAt: new Date().toISOString(), ...body };

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    res.json({ ok: true, filename, path: filePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to save record' });
  }
});

// List past CBT thought records sorted newest first.
app.get('/api/cbt/entries', (_req, res) => {
  try {
    const files = fs
      .readdirSync(CBT_DIR)
      .filter((f) => CBT_SAFE_FILENAME.test(f));

    const entries = files
      .map((filename) => {
        try {
          const record = JSON.parse(fs.readFileSync(path.join(CBT_DIR, filename), 'utf8'));
          return {
            filename,
            savedAt: record.savedAt || null,
            datetime: record.datetime || null,
            summary: cbtSummarize(record),
            emotion: record.emotion || null,
            emotionIntensity: typeof record.emotionIntensity === 'number' ? record.emotionIntensity : null
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ad = a.savedAt || a.filename;
        const bd = b.savedAt || b.filename;
        return ad < bd ? 1 : ad > bd ? -1 : 0;
      });

    res.json({ ok: true, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read entries' });
  }
});

// Get a single CBT thought record's full JSON.
app.get('/api/cbt/entries/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    if (!CBT_SAFE_FILENAME.test(filename)) {
      return res.status(400).json({ ok: false, error: 'Invalid filename' });
    }
    const filePath = path.join(CBT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'Not found' });
    }
    const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json({ ok: true, filename, record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read entry' });
  }
});

app.listen(PORT, () => {
  console.log(`BDI-II app running at http://localhost:${PORT}`);
  console.log(`Results saved to: ${RESULTS_DIR}`);
  console.log(`CBT thought records saved to: ${CBT_DIR}`);
});

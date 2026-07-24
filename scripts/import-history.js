#!/usr/bin/env node
/**
 * One-time backfill: import historical journal/gratitude entries exported from
 * other apps into journal_entries.
 * Usage: DATABASE_URL=... node scripts/import-history.js
 *
 * Reads from data_export/ (gitignored, not part of the repo):
 *   - grateful_1.csv, grateful_2.csv — DATE,TIME,PROMPT,RESPONSE[,NOTES] gratitude exports
 *   - journal_export.txt             — free-form journal export, one section per day,
 *                                       separated by "━━━━━━━━━━━━" lines, entries as
 *                                       "HH:MM text" with optional unprefixed continuation lines
 *
 * Safe to re-run — ids are derived from source content, so ON CONFLICT DO NOTHING
 * skips rows already imported.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../db');
const { initDb } = require('../migrate');
const journalCrypto = require('../lib/journal-crypto');

const DATA_DIR = path.join(__dirname, '..', 'data_export');

// Maps the exact prompt text found in the CSV exports to the canonical tags in
// server.js's GRATITUDE_TAGS. Prompts with no clean equivalent (or one-off/
// malformed rows) are left unmapped — the entry still saves as gratitude:true,
// gratitudeTag:null, which the log UI renders with a generic "Grateful for" caption.
const PROMPT_TAG_MAP = {
  'What are you looking forward to?': "Something I'm looking forward to",
  'What have you savoured today?': 'Something I savoured',
  'What made you smile today?': 'Something that made me smile',
  'What made today a good day?': 'What made today good',
  'What are you proud of today?': "Something I'm proud of",
  'What‘s something kind someone did for you today?': 'A kindness I received'
};

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const row = [];
    for (;;) {
      while (text[i] === ' ') i++;
      let field = '';
      if (text[i] === '"') {
        i++;
        while (i < n) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') { field += '"'; i += 2; }
            else { i++; break; }
          } else {
            field += text[i]; i++;
          }
        }
      } else {
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i]; i++;
        }
      }
      row.push(field);
      if (text[i] === ',') { i++; continue; }
      break;
    }
    if (text[i] === '\r') i++;
    if (text[i] === '\n') i++;
    rows.push(row);
    if (i >= n) break;
  }
  return rows;
}

function makeId(...parts) {
  const hash = crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
  return `journal-hist-${hash}`;
}

// Turns a per-date sequence of HH:MM-stamped entries into strictly increasing
// order values, nudging apart any entries that share the same minute.
function makeOrderAssigner() {
  const lastByDate = new Map();
  return (date, hh, mm) => {
    const base = Date.UTC(
      Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)),
      hh, mm
    );
    const last = lastByDate.get(date) || 0;
    const order = Math.max(base, last + 1);
    lastByDate.set(date, order);
    return order;
  };
}

async function importGratitudeCsv(file, nextOrder) {
  const csvPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(csvPath)) {
    console.log(`No ${file} found — skipping.`);
    return { imported: 0, skipped: 0 };
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const [, ...body] = rows;
  let imported = 0;
  let skipped = 0;

  for (const row of body) {
    if (!row[0] || !row[0].trim()) continue;
    const date = row[0].replace(/\//g, '-');
    const [hh, mm] = row[1].split(':').map(Number);
    const prompt = row[2];
    const text = row[3].trim();
    const tag = PROMPT_TAG_MAP[prompt] || null;

    const order = nextOrder(date, hh, mm);
    const id = makeId(file, date, row[1], text);
    const record = { id, date, order, text: text || null, mood: null, gratitude: true, gratitudeTag: tag };

    try {
      const { rowCount } = await pool.query(
        `INSERT INTO journal_entries (id, entry_date, entry_order, mood, body, gratitude, gratitude_tag, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [id, date, order, null, journalCrypto.encryptText(text || null), true, tag, journalCrypto.encryptJSON(record)]
      );
      rowCount ? imported++ : skipped++;
    } catch (err) {
      console.error(`  ✗ ${file} ${date} ${row[1]}: ${err.message}`);
    }
  }

  console.log(`${file}: ${imported} imported, ${skipped} already present.`);
  return { imported, skipped };
}

async function importJournalTxt(nextOrder) {
  const txtPath = path.join(DATA_DIR, 'journal_export.txt');
  if (!fs.existsSync(txtPath)) {
    console.log('No journal_export.txt found — skipping.');
    return { imported: 0, skipped: 0 };
  }

  const lines = fs.readFileSync(txtPath, 'utf8').split('\n');
  const dateRe = /^(\d{4})-(\d{2})-(\d{2})$/;
  const entryRe = /^(\d{2}):(\d{2}) (.*)$/;

  let currentDate = null;
  const entries = []; // { date, hh, mm, text }
  let current = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('━')) continue; // section separator
    if (dateRe.test(line)) { currentDate = line; current = null; continue; }
    if (!currentDate) continue;

    const m = entryRe.exec(line);
    if (m) {
      current = { date: currentDate, hh: Number(m[1]), mm: Number(m[2]), text: m[3].trim() };
      entries.push(current);
    } else if (line.trim() && current) {
      current.text += '\n' + line.trim();
    }
  }

  let imported = 0;
  let skipped = 0;

  for (const entry of entries) {
    const order = nextOrder(entry.date, entry.hh, entry.mm);
    const timeStr = `${String(entry.hh).padStart(2, '0')}:${String(entry.mm).padStart(2, '0')}`;
    const id = makeId('journal_export.txt', entry.date, timeStr, entry.text);
    const record = { id, date: entry.date, order, text: entry.text, mood: null, gratitude: false, gratitudeTag: null };

    try {
      const { rowCount } = await pool.query(
        `INSERT INTO journal_entries (id, entry_date, entry_order, mood, body, gratitude, gratitude_tag, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [id, entry.date, order, null, journalCrypto.encryptText(entry.text), false, null, journalCrypto.encryptJSON(record)]
      );
      rowCount ? imported++ : skipped++;
    } catch (err) {
      console.error(`  ✗ journal_export.txt ${entry.date} ${timeStr}: ${err.message}`);
    }
  }

  console.log(`journal_export.txt: ${imported} imported, ${skipped} already present.`);
  return { imported, skipped };
}

async function main() {
  console.log('Connecting to:', process.env.DATABASE_URL || 'postgres://localhost/willow');
  await initDb();

  const nextOrder = makeOrderAssigner();
  await importGratitudeCsv('grateful_1.csv', nextOrder);
  await importGratitudeCsv('grateful_2.csv', nextOrder);
  await importJournalTxt(nextOrder);

  await pool.end();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });

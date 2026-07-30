const crypto = require('crypto');
const pool = require('../db');
const journalCrypto = require('../lib/journal-crypto');

const JOURNAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Kept in sync with public/gratitude.js — used to validate that a saved
// gratitude tag actually corresponds to one of the rotating prompts.
const GRATITUDE_TAGS = new Set([
  'Something I savoured',
  "Something I'm proud of",
  "Something I'm looking forward to",
  'Something that made me smile',
  'What made today good',
  'A kindness I received',
  "Someone I'm thankful for",
  'A small comfort',
  'Something that went well',
  'Something that felt like a gift',
  "Something I'm glad to have",
  'Beauty I noticed'
]);

// ---------------------------------------------------------------------------
// Reflective followup prompts (self-compassion / ACT values)
// ---------------------------------------------------------------------------
//
// Shown occasionally on non-gratitude entries: never more than once a day,
// and forced on if a week has passed without one, otherwise a ~25% chance
// each time the compose view is saved. journal_followups logs every time
// the prompt is shown (regardless of whether it's answered) so eligibility
// can be computed from the last shown_date.

const FOLLOWUP_MIN_GAP_DAYS = 7;
const FOLLOWUP_CHANCE = 0.25;

const FOLLOWUP_QUESTIONS = {
  self_compassion: [
    'How can you show yourself kindness in this moment?',
    'What would you say to a friend who felt this way?',
    'What do you need to hear right now?',
    'Where can you offer yourself a little softness today?',
    "What's one way you could be gentler with yourself?",
    "What's one thing you can let go of righ now?",
    'What is preventing you from being compassionate to yourself?',
    'What helps you feel safe?',
    'What expectation of yourself can you let go of?',
    'Recognize, normalize, soothe'
  ],
  act_values: [
    'Are you avoiding something hard or uncomfortable?',
    "The feelings are difficult, can you let them sit and just observe?",
    'Which version of you would you rather be right now?',
    'Which of your values felt most alive today?',
    'What would acting on your values look like right now, even if it feels hard?',
    'What can you make room for today, even alongside difficult feelings?',
    "What's something you did today that felt aligned with who you want to be?",
    "The passengers are your difficult thoughts, feelings, memories, urges, and self-doubts. Can you keep driving toward the kind of life that matters to you?",
    "Accept, defuse, move towards"
  ]
};

const FOLLOWUP_THEMES = Object.keys(FOLLOWUP_QUESTIONS);

function isValidDate(date) {
  return typeof date === 'string' && JOURNAL_DATE.test(date);
}

async function createEntry(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const mood = Number.isInteger(body.mood) && body.mood >= 0 && body.mood <= 4 ? body.mood : null;
  const date = isValidDate(body.date) ? body.date : null;
  const gratitude = body.gratitude === true;
  const gratitudeTag = gratitude && typeof body.gratitudeTag === 'string' && GRATITUDE_TAGS.has(body.gratitudeTag)
    ? body.gratitudeTag
    : null;
  const followupId = Number.isInteger(body.followupId) ? body.followupId : null;
  const followupAnswer = typeof body.followupAnswer === 'string' && body.followupAnswer.trim()
    ? body.followupAnswer.trim()
    : null;

  if (!date) return { error: 'A valid date (YYYY-MM-DD) is required' };
  if (!text && mood === null) return { error: 'Write something or pick a mood' };

  const order = Date.now();
  const id = `journal-${order}-${crypto.randomBytes(4).toString('hex')}`;
  const record = { id, date, order, text: text || null, mood, gratitude, gratitudeTag };

  await pool.query(
    'INSERT INTO journal_entries (id, entry_date, entry_order, mood, body, gratitude, gratitude_tag, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, date, order, mood, journalCrypto.encryptText(text || null), gratitude, gratitudeTag, journalCrypto.encryptJSON(record)]
  );

  if (followupId !== null) {
    await pool.query(
      'UPDATE journal_followups SET entry_id = $1, answer = $2 WHERE id = $3 AND entry_id IS NULL',
      [id, journalCrypto.encryptText(followupAnswer), followupId]
    );
  }

  return { entry: record };
}

async function listEntries() {
  const { rows } = await pool.query(
    'SELECT id, entry_date, entry_order, mood, body, gratitude, gratitude_tag FROM journal_entries ORDER BY entry_date DESC, entry_order DESC'
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.entry_date.toISOString().slice(0, 10),
    order: Number(r.entry_order),
    text: journalCrypto.decryptText(r.body),
    mood: r.mood,
    gratitude: r.gratitude,
    gratitudeTag: r.gratitude_tag
  }));
}

async function updateEntry(id, text) {
  const { rows } = await pool.query('SELECT data FROM journal_entries WHERE id = $1', [id]);
  if (!rows.length) return { notFound: true };

  const data = { ...journalCrypto.decryptJSON(rows[0].data), text };
  await pool.query(
    'UPDATE journal_entries SET body = $1, data = $2 WHERE id = $3',
    [journalCrypto.encryptText(text), journalCrypto.encryptJSON(data), id]
  );
  return { text };
}

async function checkFollowup(date) {
  if (!isValidDate(date)) return { error: 'A valid date (YYYY-MM-DD) is required' };

  const { rows } = await pool.query(
    'SELECT shown_date::text AS shown_date FROM journal_followups ORDER BY shown_date DESC LIMIT 1'
  );
  const lastShown = rows[0]?.shown_date || null;

  if (lastShown === date) {
    return { show: false };
  }

  const daysSince = lastShown
    ? Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${lastShown}T00:00:00Z`)) / 86400000)
    : Infinity;

  const show = daysSince >= FOLLOWUP_MIN_GAP_DAYS || Math.random() < FOLLOWUP_CHANCE;
  if (!show) return { show: false };

  const theme = FOLLOWUP_THEMES[Math.floor(Math.random() * FOLLOWUP_THEMES.length)];
  const questions = FOLLOWUP_QUESTIONS[theme];
  const question = questions[Math.floor(Math.random() * questions.length)];

  const { rows: inserted } = await pool.query(
    'INSERT INTO journal_followups (shown_date, theme, question) VALUES ($1, $2, $3) RETURNING id',
    [date, theme, question]
  );

  return { show: true, id: inserted[0].id, theme, question };
}

module.exports = {
  createEntry,
  listEntries,
  updateEntry,
  checkFollowup,
  JOURNAL_DATE,
  GRATITUDE_TAGS
};

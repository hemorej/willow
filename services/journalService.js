// Persistence for journal entries and their occasional reflective "followups".
// Entry text and followup answers are encrypted at rest via lib/journal-crypto
// (the flat `body` column and the JSONB `data` record both hold ciphertext);
// `mood`, dates and the gratitude flag stay in the clear for querying.

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
    'What do you need to hear right now?',
    'Where can you offer yourself a little softness today?',
    'What is preventing you from being compassionate to yourself?',
    'What helps you feel safe?',
    'What expectation of yourself can you let go of?',
    'If 🐶 could see you right now, what would he want you to remember?',
    'What story are you telling yourself about this moment?',
    'If you could observe your current pain from across the room, what would you notice about myself?',
    'When you imagine the most accomplished "together" person you know, what struggles do you think they might have?',
    'What is something you judge harshly in yourself that you would not judge in someone else?',
  ],
  act_values: [
    'What discomfort or experience are you avoiding?',
    'The feelings are difficult, can you let them sit and just observe?',
    'Which version of you would you rather be right now?',
    'What would acting on your values look like right now, even if it were hard?',
    'What can you make room for today, alongside difficult feelings?',
    'Is this a fact or a thought your mind is offering you?',
    'What do you notice right now if you pause and take a breath?',
    'Can you hold this feeling a little more loosely, without pushing it away?',
    'Can you thank your mind for that thought, and let it pass through?',
    'Is there a value that felt most alive for you today?'
  ]
};

// Standalone reflective statements — shown the same way as the question
// followups (same eligibility/frequency logic), but as a plain acknowledgment
// with no answer captured, so they never appear in the journal-log footnotes.
const FOLLOWUP_STATEMENTS = [
  "The observing self: I'm having the thought ... rather than being that thought",
  'Thoughts are just mental events, not facts',
  'You can observe feelings without being consumed by them',
  'You are driving a van with loud passengers: thoughts, feelings, memories, urges, and self-doubts. Keep driving toward the life that matters to you',
  'Notice, name, normalize then soothe: offer yourself kindness',
  'You are here. You are okay. You do not have to escape this.',
  'Notice, accept, defuse, then move towards a value'
];

const FOLLOWUP_THEMES = [...Object.keys(FOLLOWUP_QUESTIONS), 'statement'];

/** True if `date` is a "YYYY-MM-DD" string (format only, not calendar-validity). */
function isValidDate(date) {
  return typeof date === 'string' && JOURNAL_DATE.test(date);
}

/**
 * Validate and persist a new journal entry, encrypting its text. If a
 * `followupId` is supplied, the matching (still-unanswered) followup row is
 * updated with the answer and linked to this entry.
 *
 * @param {object} body {text, mood 0-4, date, gratitude, gratitudeTag, followupId, followupAnswer}
 * @returns {Promise<{error: string} | {entry: object}>} `error` for validation failures.
 */
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

/**
 * All entries, newest-first, with any answered followup joined in and all
 * ciphertext fields decrypted for the client.
 *
 * @returns {Promise<Array<object>>}
 */
async function listEntries() {
  const { rows } = await pool.query(
    `SELECT je.id, je.entry_date, je.entry_order, je.mood, je.body, je.gratitude, je.gratitude_tag,
            jf.theme AS followup_theme, jf.question AS followup_question, jf.answer AS followup_answer
     FROM journal_entries je
     LEFT JOIN journal_followups jf ON jf.entry_id = je.id AND jf.answer IS NOT NULL
     ORDER BY je.entry_date DESC, je.entry_order DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.entry_date.toISOString().slice(0, 10),
    order: Number(r.entry_order),
    text: journalCrypto.decryptText(r.body),
    mood: r.mood,
    gratitude: r.gratitude,
    gratitudeTag: r.gratitude_tag,
    followupTheme: r.followup_theme || null,
    followupQuestion: r.followup_question || null,
    followupAnswer: journalCrypto.decryptText(r.followup_answer)
  }));
}

/**
 * Replace an entry's body text (re-encrypting both the `body` column and the
 * `text` field inside the JSONB record). Only the text is editable.
 *
 * @param {string} id
 * @param {string} text Already trimmed and non-empty (checked in the controller)
 * @returns {Promise<{notFound: true} | {text: string}>}
 */
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

/**
 * Decide whether to show a reflective followup prompt for `date`, and if so,
 * pick one and log it in journal_followups (so it counts as "shown" even if
 * never answered). At most one per day; forced when {@link FOLLOWUP_MIN_GAP_DAYS}
 * have passed since the last one, otherwise a {@link FOLLOWUP_CHANCE} coin flip.
 *
 * @param {string} date "YYYY-MM-DD"
 * @returns {Promise<{error: string} | {show: false} | {show: true, id: number, theme: string, kind: 'question'|'statement', question: string}>}
 */
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

  // Pick a theme, then a random line from that theme's set. `pool_` is the
  // candidate array (trailing underscore avoids shadowing the pg `pool`).
  const theme = FOLLOWUP_THEMES[Math.floor(Math.random() * FOLLOWUP_THEMES.length)];
  const kind = theme === 'statement' ? 'statement' : 'question';
  const pool_ = kind === 'statement' ? FOLLOWUP_STATEMENTS : FOLLOWUP_QUESTIONS[theme];
  const question = pool_[Math.floor(Math.random() * pool_.length)];

  const { rows: inserted } = await pool.query(
    'INSERT INTO journal_followups (shown_date, theme, question) VALUES ($1, $2, $3) RETURNING id',
    [date, theme, question]
  );

  return { show: true, id: inserted[0].id, theme, kind, question };
}

module.exports = {
  createEntry,
  listEntries,
  updateEntry,
  checkFollowup,
  JOURNAL_DATE,
  GRATITUDE_TAGS
};

// Check-in instruments.
//
//  - phq9x (current): the PHQ-9 (public domain) plus 4 extra items — future
//    outlook, helplessness, self-criticism, irritability — all on the PHQ-9's
//    0..3 frequency scale over the last 2 weeks. 13 items, max 39. The extras
//    are added into the total, so this is NOT a validated PHQ-9 score; its
//    bands are the PHQ-9 cut-offs (5/10/15/20) scaled by 39/27 and shown in
//    the UI as a "Willow score", not a clinical severity.
//  - bdi2 (archive): the legacy BDI-II, kept only so past results stay
//    viewable. Never offered for new entries.

// Archive: BDI-II questions and severity ranges.
// Question 9 (Suicidal ideas) is intentionally omitted, so this version
// has 20 items instead of the standard 21. Each item is scored 0..3.
// Max possible total = 60 (vs 63 for the full BDI-II).
//
// Severity ranges are the standard BDI-II cut-offs scaled by 60/63
// (~ 0.9524) and rounded to integer cut-points.

const BDI2_QUESTIONS = [
  {
    title: 'Sadness',
    answers: [
      { score: 0, text: 'I do not feel sad' },
      { score: 1, text: 'I feel sad' },
      { score: 2, text: "I am sad all the time and I can't snap out of it" },
      { score: 3, text: "I am so sad and unhappy that I can't stand it" }
    ]
  },
  {
    title: 'Pessimism',
    answers: [
      { score: 0, text: 'I am not particularly discouraged about the future' },
      { score: 1, text: 'I feel discouraged about the future' },
      { score: 2, text: 'I feel I have nothing to look forward to' },
      { score: 3, text: 'I feel the future is hopeless and that things cannot improve' }
    ]
  },
  {
    title: 'Sense of failure',
    answers: [
      { score: 0, text: 'I do not feel like a failure' },
      { score: 1, text: 'I feel I have failed more than the average person' },
      { score: 2, text: 'As I look back on my life, all I can see is a lot of failures' },
      { score: 3, text: 'I feel I am a complete failure as a person' }
    ]
  },
  {
    title: 'Loss of pleasure',
    answers: [
      { score: 0, text: 'I get as much satisfaction out of things as I used to' },
      { score: 1, text: "I don't enjoy things the way I used to" },
      { score: 2, text: "I don't get real satisfaction out of anything anymore" },
      { score: 3, text: 'I am dissatisfied or bored with everything' }
    ]
  },
  {
    title: 'Guilt',
    answers: [
      { score: 0, text: "I don't feel particularly guilty" },
      { score: 1, text: 'I feel guilty a good part of the time' },
      { score: 2, text: 'I feel quite guilty most of the time' },
      { score: 3, text: 'I feel guilty all of the time' }
    ]
  },
  {
    title: 'Sense of punishment',
    answers: [
      { score: 0, text: "I don't feel I am being punished" },
      { score: 1, text: 'I feel I may be punished' },
      { score: 2, text: 'I expect to be punished' },
      { score: 3, text: 'I feel I am being punished' }
    ]
  },
  {
    title: 'Self-loathing',
    answers: [
      { score: 0, text: "I don't feel disappointed in myself" },
      { score: 1, text: 'I am disappointed in myself' },
      { score: 2, text: 'I am disgusted with myself' },
      { score: 3, text: 'I hate myself' }
    ]
  },
  {
    title: 'Self-incrimination',
    answers: [
      { score: 0, text: "I don't feel I am any worse than anybody else" },
      { score: 1, text: 'I am critical of myself for my weaknesses or mistakes' },
      { score: 2, text: 'I blame myself all the time for my faults' },
      { score: 3, text: 'I blame myself for everything bad that happens' }
    ]
  },
  // Question 9 (Suicidal ideas) intentionally omitted.
  {
    title: 'Crying',
    answers: [
      { score: 0, text: "I don't cry any more than usual" },
      { score: 1, text: 'I cry more now than I used to' },
      { score: 2, text: 'I cry all the time now' },
      { score: 3, text: "I used to be able to cry, but now I can't cry even though I want to" }
    ]
  },
  {
    title: 'Irritability',
    answers: [
      { score: 0, text: 'I am no more irritated by things than I ever was' },
      { score: 1, text: 'I am slightly more irritated now than usual' },
      { score: 2, text: 'I am quite annoyed or irritated a good deal of the time' },
      { score: 3, text: 'I feel irritated all the time' }
    ]
  },
  {
    title: 'Social withdrawal',
    answers: [
      { score: 0, text: 'I have not lost interest in other people' },
      { score: 1, text: 'I am less interested in other people than I used to be' },
      { score: 2, text: 'I have lost most of my interest in other people' },
      { score: 3, text: 'I have lost all of my interest in other people' }
    ]
  },
  {
    title: 'Indecision',
    answers: [
      { score: 0, text: 'I make decisions about as well as I ever could' },
      { score: 1, text: 'I put off making decisions more than I used to' },
      { score: 2, text: 'I have greater difficulty in making decisions more than I used to' },
      { score: 3, text: "I can't make decisions at all anymore" }
    ]
  },
  {
    title: 'Feelings of worthlessness',
    answers: [
      { score: 0, text: "I don't feel that I look any worse than I used to" },
      { score: 1, text: 'I am worried that I am looking old or unattractive' },
      { score: 2, text: 'I feel there are permanent changes in my appearance that make me look unattractive' },
      { score: 3, text: 'I believe that I look ugly' }
    ]
  },
  {
    title: 'Difficulty concentrating',
    answers: [
      { score: 0, text: 'I can work about as well as before' },
      { score: 1, text: 'It takes an extra effort to get started at doing something' },
      { score: 2, text: 'I have to push myself very hard to do anything' },
      { score: 3, text: "I can't do any work at all" }
    ]
  },
  {
    title: 'Change of sleep',
    answers: [
      { score: 0, text: 'I can sleep as well as usual' },
      { score: 1, text: "I don't sleep as well as I used to" },
      { score: 2, text: 'I wake up 1-2 hours earlier than usual and find it hard to get back to sleep' },
      { score: 3, text: 'I wake up several hours earlier than I used to and cannot get back to sleep' }
    ]
  },
  {
    title: 'Fatigue',
    answers: [
      { score: 0, text: "I don't get more tired than usual" },
      { score: 1, text: 'I get tired more easily than I used to' },
      { score: 2, text: 'I get tired from doing almost anything' },
      { score: 3, text: 'I am too tired to do anything' }
    ]
  },
  {
    title: 'Changes in appetite',
    answers: [
      { score: 0, text: 'My appetite is no worse than usual' },
      { score: 1, text: 'My appetite is not as good as it used to be' },
      { score: 2, text: 'My appetite is much worse now' },
      { score: 3, text: 'I have no appetite at all anymore' }
    ]
  },
  {
    title: 'Weight changes',
    answers: [
      { score: 0, text: "I haven't lost much weight, if any, lately" },
      { score: 1, text: 'I have lost more than 2.3 kg' },
      { score: 2, text: 'I have lost more than 4.5 kg' },
      { score: 3, text: 'I have lost more than 6.8 kg' }
    ]
  },
  {
    title: 'Health',
    answers: [
      { score: 0, text: 'I am no more worried about my health than usual' },
      { score: 1, text: 'I am worried about physical problems like aches, pains, upset stomach, or constipation' },
      { score: 2, text: "I am very worried about physical problems and it's hard to think of much else" },
      { score: 3, text: 'I am so worried about my physical problems that I cannot think of anything else' }
    ]
  },
  {
    title: 'Loss of interest in sex',
    answers: [
      { score: 0, text: 'I have not noticed any recent change in my interest in sex' },
      { score: 1, text: 'I am less interested in sex than I used to be' },
      { score: 2, text: 'I have almost no interest in sex' },
      { score: 3, text: 'I have lost interest in sex completely' }
    ]
  }
];

// Severity ranges, scaled from the standard BDI-II to a 0..60 max because
// question 9 was omitted (60/63 ≈ 0.9524, rounded to integer cut-points).
// Standard ranges: 0-13 minimal, 14-19 mild, 20-28 moderate, 29-63 severe.
const BDI2_BANDS = [
  { name: 'Minimal',  min: 0,  max: 12, color: '#5a9e73' },
  { name: 'Mild',     min: 13, max: 18, color: '#d0a83a' },
  { name: 'Moderate', min: 19, max: 26, color: '#d98040' },
  { name: 'Severe',   min: 27, max: 60, color: '#c15a4e' }
];

// Shared response scale for every phq9x item.
const PHQ9X_ANSWERS = [
  { score: 0, text: 'Not at all' },
  { score: 1, text: 'Several days' },
  { score: 2, text: 'More than half the days' },
  { score: 3, text: 'Nearly every day' }
];

// Each item has a stable `id` (answers are stored and scored by id, never by
// screen position) and a `group` used only to build the presentation order.
// Canonical order below is the PHQ-9 order, then the extras.
const PHQ9X_ITEMS = [
  { id: 'interest',     group: 'core',  title: 'Little interest or pleasure in doing things' },
  { id: 'mood',         group: 'core',  title: 'Feeling down, depressed or hopeless' },
  { id: 'sleep',        group: 'core',  title: 'Trouble falling or staying asleep, or sleeping too much' },
  { id: 'energy',       group: 'core',  title: 'Feeling tired or having little energy' },
  { id: 'appetite',     group: 'core',  title: 'Poor appetite or overeating' },
  { id: 'self_worth',   group: 'core',  title: 'Feeling bad about yourself \u2013 or that you are a failure or have let yourself or your family down' },
  { id: 'concentration', group: 'core', title: 'Trouble concentrating on things, such as reading the newspaper or watching television' },
  { id: 'psychomotor',  group: 'core',  title: 'Moving or speaking so slowly that other people could have noticed. Or the opposite \u2013 being so fidgety or restless that you have been moving around a lot more than usual' },
  { id: 'self_harm',    group: 'last',  title: 'Thoughts that you would be better off dead, or of hurting yourself in some way' },
  // Extras (original wording, not from the BDI-II or PROMIS):
  { id: 'outlook',      group: 'extra', title: 'Feeling hopeless or pessimistic about the future' },
  { id: 'helplessness', group: 'extra', title: 'Feeling helpless or stuck, as if nothing you do will help' },
  { id: 'self_critic',  group: 'extra', title: 'Being harshly self-critical, or feeling worthless' },
  { id: 'irritability', group: 'extra', title: 'Feeling irritable or having a short temper' }
];

// Id of the PHQ-9 suicidal-thoughts item; a non-zero answer triggers the
// crisis-resources note on the result screen.
const PHQ9X_SELF_HARM_ID = 'self_harm';

// Canonical (stable) order: used for storage so saved records line up across
// check-ins regardless of the order the items were shown in.
const PHQ9X_QUESTIONS = PHQ9X_ITEMS.map((item, i) => ({
  id: item.id,
  group: item.group,
  canonicalIndex: i,
  title: item.title,
  answers: PHQ9X_ANSWERS
}));

/** In-place Fisher-Yates shuffle; returns the array. */
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Presentation order for one run of the check-in: the 8 core PHQ-9 items
 * shuffled, then the 4 extras shuffled (kept together), then the suicidal-
 * thoughts item last so it is never the opening question or buried mid-list.
 * @param {Array<{group: string}>} questions
 */
function presentationOrder(questions) {
  const pick = (g) => questions.filter((q) => q.group === g);
  return [...shuffleInPlace(pick('core')), ...shuffleInPlace(pick('extra')), ...pick('last')];
}

// PHQ-9 cut-offs 5/10/15/20 scaled by 39/27 (max score 39) and rounded.
const PHQ9X_BANDS = [
  { name: 'Minimal',           min: 0,  max: 6,  color: '#5a9e73' },
  { name: 'Mild',              min: 7,  max: 13, color: '#d0a83a' },
  { name: 'Moderate',          min: 14, max: 21, color: '#d98040' },
  { name: 'Moderately severe', min: 22, max: 28, color: '#c9684a' },
  { name: 'Severe',            min: 29, max: 39, color: '#c15a4e' }
];

/**
 * Returns the band for a score, falling back to the highest band.
 * @param {Array<{name: string, min: number, max: number, color: string}>} bands
 * @param {number} score
 */
function bandFor(bands, score) {
  for (const b of bands) {
    if (score >= b.min && score <= b.max) return b;
  }
  return bands[bands.length - 1];
}

const INSTRUMENTS = {
  phq9x: {
    id: 'phq9x',
    label: 'Check-in',
    questions: PHQ9X_QUESTIONS,
    severityBands: PHQ9X_BANDS,
    maxScore: 39,
    severityFor: (score) => bandFor(PHQ9X_BANDS, score)
  },
  bdi2: {
    id: 'bdi2',
    label: 'BDI-II (archive)',
    questions: BDI2_QUESTIONS,
    severityBands: BDI2_BANDS,
    maxScore: 60,
    severityFor: (score) => bandFor(BDI2_BANDS, score)
  }
};

const CURRENT_INSTRUMENT_ID = 'phq9x';

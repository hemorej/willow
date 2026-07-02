// BDI-II questions and severity ranges.
// Question 9 (Suicidal ideas) is intentionally omitted, so this version
// has 20 items instead of the standard 21. Each item is scored 0..3.
// Max possible total = 60 (vs 63 for the full BDI-II).
//
// Severity ranges are the standard BDI-II cut-offs scaled by 60/63
// (~ 0.9524) and rounded to integer cut-points.

const QUESTIONS = [
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
      { score: 1, text: 'I have lost more than five pounds' },
      { score: 2, text: 'I have lost more than ten pounds' },
      { score: 3, text: 'I have lost more than fifteen pounds' }
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
const SEVERITY_BANDS = [
  { name: 'Minimal',  min: 0,  max: 12, color: '#5a9e73' },
  { name: 'Mild',     min: 13, max: 18, color: '#d0a83a' },
  { name: 'Moderate', min: 19, max: 26, color: '#d98040' },
  { name: 'Severe',   min: 27, max: 60, color: '#c15a4e' }
];

/**
 * Returns the severity band for a given total score.
 * Falls back to the last (highest) band if no range matches.
 * @param {number} score - Total BDI-II score (0–60).
 * @returns {{ name: string, min: number, max: number, color: string }}
 */
function severityFor(score) {
  for (const b of SEVERITY_BANDS) {
    if (score >= b.min && score <= b.max) return b;
  }
  return SEVERITY_BANDS[SEVERITY_BANDS.length - 1];
}

const MAX_SCORE = 60;

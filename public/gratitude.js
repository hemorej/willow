// Shared gratitude-prompt data and sprout icon for the journal compose and log views.
const GRATITUDE_PROMPTS = [
  { prompt: 'What did you savour today?', tag: 'Something I savoured' },
  { prompt: 'What made you proud today?', tag: "Something I'm proud of" },
  { prompt: 'What are you looking forward to?', tag: "Something I'm looking forward to" },
  { prompt: 'What made you smile today?', tag: 'Something that made me smile' },
  { prompt: 'What made today a good day?', tag: 'What made today good' },
  { prompt: "What's something kind someone did for you today?", tag: 'A kindness I received' },
  { prompt: 'Who are you thankful for today?', tag: "Someone I'm thankful for" },
  { prompt: 'What small comfort did you enjoy?', tag: 'A small comfort' },
  { prompt: 'What went better than expected?', tag: 'Something that went well' },
  { prompt: 'What in your day felt like a gift?', tag: 'Something that felt like a gift' },
  { prompt: 'What are you glad you have right now?', tag: "Something I'm glad to have" },
  { prompt: 'What beauty did you notice today?', tag: 'Beauty I noticed' },
];

function sproutSvg(size) {
  const s = size || 14;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12"/><path d="M12 12c0-3 2-5 6-5 0 3-2 5-6 5z"/><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/></svg>`;
}

function followupSvg(size) {
  const s = size || 13;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
}

// Shared mood-face assets for the journal home and log views.
const MOODS = [
  { name: 'great', mouth: 'M12 24 Q20 33 28 24' },
  { name: 'good', mouth: 'M13 25 Q20 30 27 25' },
  { name: 'okay', mouth: 'M13 26 L27 26' },
  { name: 'low', mouth: 'M13 27.5 Q20 23.5 27 27.5' },
  { name: 'rough', mouth: 'M12 28 Q20 22 28 28' },
];

function moodFaceSvg(index, size) {
  const m = MOODS[index];
  const s = size || 30;
  return `<svg width="${s}" height="${s}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="20" cy="20" r="18"/>
    <circle cx="14" cy="17" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="26" cy="17" r="1.5" fill="currentColor" stroke="none"/>
    <path d="${m.mouth}"/>
  </svg>`;
}

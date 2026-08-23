// Shared mood-face assets for the journal home and log views.
const MOODS = [
  { name: 'great', mouth: 'M12 24 Q20 33 28 24', eyes: 'arc' },
  { name: 'good', mouth: 'M13 25 Q20 30 27 25' },
  { name: 'okay', mouth: 'M13 26 L27 26' },
  { name: 'low', mouth: 'M13 27.5 Q20 23.5 27 27.5' },
  { name: 'rough', mouth: 'M12 28 Q20 22 28 28', eyes: 'arc' },
];

function moodFaceSvg(index, size) {
  const m = MOODS[index];
  const s = size || 30;
  const strokeWidth = s <= 16 ? 2.6 : 1.6;
  const eyeRadius = s <= 16 ? 1.8 : 1.5;
  const eyes = m.eyes === 'arc'
    ? `<path d="M11 18 Q14 14 17 18"/><path d="M23 18 Q26 14 29 18"/>`
    : `<circle cx="14" cy="17" r="${eyeRadius}" fill="currentColor" stroke="none"/>
    <circle cx="26" cy="17" r="${eyeRadius}" fill="currentColor" stroke="none"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="20" cy="20" r="18"/>
    ${eyes}
    <path d="${m.mouth}"/>
  </svg>`;
}

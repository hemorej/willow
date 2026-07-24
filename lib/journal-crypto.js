// AES-256-GCM encryption for journal entry content, with a version tag on
// every ciphertext so a key rotation can tell which key encrypted which row
// (see scripts/rotate-key.js) without needing an all-or-nothing cutover.
//
// Envelope format: "v<version>:<iv base64>:<authTag base64>:<ciphertext base64>"

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function loadKey(envVar) {
  const raw = process.env[envVar];
  if (!raw) return null;
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error(`${envVar} must be 32 bytes encoded as 64 hex characters`);
  }
  return key;
}

const CURRENT_VERSION = parseInt(process.env.JOURNAL_ENC_KEY_VERSION || '1', 10);

// Keys are looked up by version. Only the current version is needed for new
// writes; older versions are kept only so rows encrypted under a since-rotated
// key stay readable (e.g. mid-rotation, before scripts/rotate-key.js has
// rewrapped every row).
const KEYS = new Map();
const currentKey = loadKey('JOURNAL_ENC_KEY');
if (currentKey) KEYS.set(CURRENT_VERSION, currentKey);

const prevKey = loadKey('JOURNAL_ENC_KEY_PREV');
const prevVersion = parseInt(process.env.JOURNAL_ENC_KEY_PREV_VERSION || '', 10);
if (prevKey && Number.isInteger(prevVersion)) KEYS.set(prevVersion, prevKey);

const ENCRYPTION_ENABLED = KEYS.size > 0;

function keyFor(version) {
  const key = KEYS.get(version);
  if (!key) throw new Error(`No encryption key configured for version ${version}`);
  return key;
}

function encryptText(plaintext, version = CURRENT_VERSION) {
  if (plaintext === null || plaintext === undefined) return null;
  const key = keyFor(version);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${version}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

const ENVELOPE_RE = /^v(\d+):([^:]+):([^:]+):([^:]+)$/;

function isEnvelope(value) {
  return typeof value === 'string' && ENVELOPE_RE.test(value);
}

function decryptText(envelope) {
  if (envelope === null || envelope === undefined) return null;
  const match = ENVELOPE_RE.exec(envelope);
  if (!match) return envelope; // legacy plaintext row from before encryption was added
  const [, versionStr, ivB64, tagB64, ctB64] = match;
  const key = keyFor(parseInt(versionStr, 10));
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// data JSONB columns hold structured records. We encrypt the whole thing and
// store it back as JSONB by wrapping the envelope string in a plain object,
// so the column type/storage doesn't need to change.
function encryptJSON(value, version = CURRENT_VERSION) {
  if (value === null || value === undefined) return null;
  return { enc: encryptText(JSON.stringify(value), version) };
}

function decryptJSON(stored) {
  if (stored === null || stored === undefined) return null;
  if (typeof stored === 'object' && !Array.isArray(stored) && typeof stored.enc === 'string') {
    return JSON.parse(decryptText(stored.enc));
  }
  return stored; // legacy plaintext row from before encryption was added
}

module.exports = {
  ENCRYPTION_ENABLED,
  CURRENT_VERSION,
  encryptText,
  decryptText,
  encryptJSON,
  decryptJSON,
  isEnvelope
};

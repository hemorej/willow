const bcrypt = require('bcryptjs');
const pool = require('../db');

async function verifyCredentials(username, password) {
  const { rows } = await pool.query(
    'SELECT id, password_hash FROM users WHERE username = $1',
    [String(username).trim()]
  );
  if (!rows.length) return null;
  const ok = await bcrypt.compare(String(password), rows[0].password_hash);
  if (!ok) return null;
  return rows[0].id;
}

module.exports = { verifyCredentials };

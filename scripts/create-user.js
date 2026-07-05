#!/usr/bin/env node
/**
 * Create or update the app user.
 * Usage: DATABASE_URL=... node scripts/create-user.js
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { initDb } = require('../migrate');

async function main() {
  await initDb();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  const username = (await ask('Username: ')).trim();
  const password = await ask('Password: ');
  rl.close();

  if (!username || !password) {
    console.error('Username and password are required.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, hash]
  );

  console.log(`User "${username}" created/updated.`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });

// Shared pg connection pool. Every module requires this same instance, so the
// whole app runs on one pool. Defaults to a local `bdi2` database when
// DATABASE_URL is unset (local dev).
const { Pool } = require('pg');

module.exports = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/bdi2'
});

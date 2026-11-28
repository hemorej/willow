// Security response headers (helmet), including the Content-Security-Policy.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const { STATIC_DIR } = require('../config/env');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * CSP source hashes for every inline <script> in the served HTML, so those run
 * without allowing 'unsafe-inline'. Computed once at startup: after editing an
 * inline script, restart the server.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function inlineScriptHashes(dir) {
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.html'))
    .flatMap((file) => {
      // Browsers hash the script text with newlines normalised to \n.
      const html = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n?/g, '\n');
      return Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), ([, code]) =>
        `'sha256-${crypto.createHash('sha256').update(code).digest('base64')}'`);
    });
}

const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", ...inlineScriptHashes(STATIC_DIR)],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'"],
      styleSrcAttr: ["'unsafe-inline'"], // style="" in the markup and generated SVG
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  strictTransportSecurity: isProduction && { maxAge: 365 * 24 * 60 * 60, includeSubDomains: false },
  // nginx already sends this header (infra/forge-conf/site.conf); don't send a conflicting one.
  xXssProtection: false
});

/** API responses carry private data: keep them out of browser and proxy caches. */
function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

module.exports = { securityHeaders, noStore };

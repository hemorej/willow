// Builds minified production assets from public/ into dist/.
// Run with: pnpm run build
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const SRC_DIR = path.join(__dirname, '..', 'public');
const OUT_DIR = path.join(__dirname, '..', 'dist');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// sw.js must be served unhashed from the root (Web Push service worker scope requirement).
const UNHASHED_JS = ['sw.js'];
const HASHED_JS = ['questions.js', 'moods.js', 'gratitude.js', 'theme.js', 'push.js'];

/** Minify JS/CSS with esbuild (content-hashed filenames, except sw.js) and copy remaining static assets to dist/. */
async function build() {
  await esbuild.build({
    entryPoints: UNHASHED_JS.map((f) => path.join(SRC_DIR, f)),
    outdir: OUT_DIR,
    minify: true,
    bundle: false,
    sourcemap: true,
    target: 'es2018'
  });

  const hashedJsResult = await esbuild.build({
    entryPoints: HASHED_JS.map((f) => path.join(SRC_DIR, f)),
    outdir: OUT_DIR,
    entryNames: '[name].[hash]',
    minify: true,
    bundle: false,
    sourcemap: true,
    target: 'es2018',
    metafile: true
  });

  const cssResult = await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'style.css')],
    outdir: OUT_DIR,
    entryNames: '[name].[hash]',
    minify: true,
    sourcemap: true,
    metafile: true
  });

  // Map original filename (e.g. "questions.js") -> hashed filename actually written to dist/.
  const assetManifest = {};
  for (const result of [hashedJsResult, cssResult]) {
    for (const outPath of Object.keys(result.metafile.outputs)) {
      if (outPath.endsWith('.map')) continue;
      const hashedName = path.basename(outPath);
      const originalName = hashedName.replace(/\.[A-Z0-9]{8}\./, '.');
      assetManifest[originalName] = hashedName;
    }
  }

  /**
   * Recursively copy src into dest, mirroring the directory structure.
   * @param {string} src
   * @param {string} dest
   */
  function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        copyRecursive(path.join(src, entry), path.join(dest, entry));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  for (const file of fs.readdirSync(SRC_DIR)) {
    if (file.endsWith('.js') || file.endsWith('.css')) continue;
    copyRecursive(path.join(SRC_DIR, file), path.join(OUT_DIR, file));
  }

  // Rewrite references to hashed assets in HTML.
  for (const file of fs.readdirSync(OUT_DIR)) {
    if (!file.endsWith('.html')) continue;
    const filePath = path.join(OUT_DIR, file);
    let html = fs.readFileSync(filePath, 'utf8');
    for (const [originalName, hashedName] of Object.entries(assetManifest)) {
      html = html.split(`/${originalName}"`).join(`/${hashedName}"`);
    }
    fs.writeFileSync(filePath, html);
  }

  console.log(`Built production assets to ${path.relative(process.cwd(), OUT_DIR)}/`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

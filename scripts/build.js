// Builds minified production assets from public/ into dist/.
// Run with: pnpm run build
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const SRC_DIR = path.join(__dirname, '..', 'public');
const OUT_DIR = path.join(__dirname, '..', 'dist');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

/** Minify JS/CSS with esbuild and copy remaining static assets to dist/. */
async function build() {
  await esbuild.build({
    entryPoints: [
      path.join(SRC_DIR, 'questions.js'),
      path.join(SRC_DIR, 'moods.js'),
      path.join(SRC_DIR, 'gratitude.js'),
      path.join(SRC_DIR, 'theme.js')
    ],
    outdir: OUT_DIR,
    minify: true,
    bundle: false,
    sourcemap: true,
    target: 'es2018'
  });

  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'style.css')],
    outfile: path.join(OUT_DIR, 'style.css'),
    minify: true,
    sourcemap: true
  });

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

  console.log(`Built production assets to ${path.relative(process.cwd(), OUT_DIR)}/`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

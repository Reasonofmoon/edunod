// EduNod Build, Link, Anchor & Semantic Integrity Verifier (not shipped in dist/)
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
if (!fs.existsSync(distDir)) {
  console.error('ERROR: dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

const allFiles = walk(distDir);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

const expectedRoutes = [
  'index.html',
  path.join('catalog', 'index.html'),
  path.join('studio', 'index.html'),
  path.join('docs', 'index.html'),
  path.join('docs', 'get-started', 'install-desktop', 'index.html'),
  path.join('docs', 'connect', 'apps', 'index.html'),
  path.join('docs', 'connect', 'models', 'index.html'),
  path.join('docs', 'trust', 'privacy', 'index.html'),
  path.join('docs', 'how-it-works', 'benchmarks', 'index.html'),
];

let errors = 0;

for (const rel of expectedRoutes) {
  const full = path.join(distDir, rel);
  if (!fs.existsSync(full)) {
    console.error(`MISSING ROUTE: ${rel}`);
    errors++;
  }
}

// Disallowed shipped directories
for (const forbidden of ['tools', '_ref']) {
  if (fs.existsSync(path.join(distDir, forbidden))) {
    console.error(`FORBIDDEN DIR IN DIST: ${forbidden}`);
    errors++;
  }
}

const idCache = new Map();
function getIdsForFile(filePath) {
  if (!idCache.has(filePath)) {
    const html = fs.readFileSync(filePath, 'utf8');
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    idCache.set(filePath, ids);
  }
  return idCache.get(filePath);
}

for (const file of htmlFiles) {
  const relFile = path.relative(distDir, file);
  const html = fs.readFileSync(file, 'utf8');

  if (!/<html[^>]*lang="ko"/.test(html)) {
    console.error(`[${relFile}] Missing <html lang="ko">`);
    errors++;
  }
  if (!/<main[\s>]/.test(html)) {
    console.error(`[${relFile}] Missing <main> landmark`);
    errors++;
  }
  if (!/<header[\s>]/.test(html)) {
    console.error(`[${relFile}] Missing <header> landmark`);
    errors++;
  }
  if (html.includes('nod.n8n.io')) {
    console.error(`[${relFile}] Found leftover external nod.n8n.io reference`);
    errors++;
  }

  // Verify internal href & src
  for (const m of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
    const raw = m[1];
    const [pathname, hash] = raw.split('#');
    const cleanPath = pathname.split('?')[0];
    let targetFile = path.join(distDir, cleanPath);
    if (cleanPath.endsWith('/')) {
      targetFile = path.join(targetFile, 'index.html');
    } else if (!path.extname(cleanPath) && fs.existsSync(path.join(targetFile, 'index.html'))) {
      targetFile = path.join(targetFile, 'index.html');
    }

    if (!fs.existsSync(targetFile)) {
      console.error(`[${relFile}] Broken local reference: ${raw}`);
      errors++;
      continue;
    }

    if (hash && targetFile.endsWith('.html')) {
      const ids = getIdsForFile(targetFile);
      if (!ids.has(hash)) {
        console.error(`[${relFile}] Broken anchor #${hash} in ${raw}`);
        errors++;
      }
    }
  }

  // Verify same-page #hash links
  for (const m of html.matchAll(/\bhref="#([^"]+)"/g)) {
    const hash = m[1];
    const ids = getIdsForFile(file);
    if (!ids.has(hash)) {
      console.error(`[${relFile}] Broken same-page anchor: #${hash}`);
      errors++;
    }
  }
}

console.log(`Checked ${htmlFiles.length} HTML pages (${allFiles.length} total files in dist/).`);
if (errors > 0) {
  console.error(`Verification FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('ALL CHECKS PASSED: 0 broken links, 0 broken anchors, Korean lang & landmarks verified.');
}

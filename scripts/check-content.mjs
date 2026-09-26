// Fails when UI, email or legal text contains an emoji, an em dash or an en dash.
// Content rules: design/project/HANDOFF.md and the project brief.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TARGETS = ['src', 'shared', 'server', 'legal', 'index.html', 'public/manifest.webmanifest'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.md', '.json', '.webmanifest']);
const RULES = [
  { name: 'em dash', re: /—/ },
  { name: 'en dash', re: /–/ },
  { name: 'emoji', re: /\p{Extended_Pictographic}/u },
];

function* walk(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) yield* walk(join(path, entry));
  } else if (EXTENSIONS.has(extname(path))) {
    yield path;
  }
}

const problems = [];
for (const target of TARGETS) {
  for (const file of walk(join(ROOT, target))) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        if (rule.re.test(line)) problems.push(`${relative(ROOT, file)}:${i + 1} contains an ${rule.name}`);
      }
    });
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nContent check failed: ${problems.length} problem(s).`);
  process.exit(1);
}
console.warn('Content check passed.');

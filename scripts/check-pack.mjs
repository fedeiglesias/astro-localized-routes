// Asserts that the npm tarball holds exactly the files a consumer needs, and that every
// path referenced by package.json (exports, types) is inside it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXPECTED = [
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'dist/index.d.ts',
  'dist/index.js',
  'package.json',
];

const output = execFileSync('pnpm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' });
const packed = JSON.parse(output)
  .files.map((file) => file.path)
  .sort();

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const referenced = [
  pkg.types,
  ...Object.values(pkg.exports).flatMap((entry) =>
    typeof entry === 'string' ? [entry] : Object.values(entry),
  ),
].map((path) => path.replace(/^\.\//, ''));

const problems = [
  ...EXPECTED.filter((path) => !packed.includes(path)).map((path) => `missing: ${path}`),
  ...packed.filter((path) => !EXPECTED.includes(path)).map((path) => `unexpected: ${path}`),
  ...referenced
    .filter((path) => !packed.includes(path))
    .map((path) => `referenced but not packed: ${path}`),
];

if (problems.length > 0) {
  console.error(`Tarball contents are wrong:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`Tarball OK (${packed.length} files):\n${packed.map((p) => `  ${p}`).join('\n')}`);

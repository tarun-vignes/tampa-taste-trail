import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = process.cwd();
const skip = new Set(['node_modules', '.git', 'artifacts', 'coverage']);
const secrets = ['QLOO_API_KEY', 'GEMINI_API_KEY']
  .map((key) => process.env[key])
  .filter((value): value is string => !!value && value.length > 12);
const found: string[] = [];
let files = 0;
function scan(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    if (entry.name.startsWith('.env') && entry.name !== '.env.example')
      continue;
    if (
      !entry.isFile() ||
      statSync(path).size > 8000000 ||
      entry.name.endsWith('.map') ||
      entry.name.endsWith('.tsbuildinfo')
    )
      continue;
    const text = readFileSync(path, 'utf8');
    files++;
    if (
      secrets.some((secret) => text.includes(secret)) ||
      /AIza[0-9A-Za-z_-]{30,}/.test(text) ||
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text)
    )
      found.push(relative(root, path));
  }
}
scan(root);
const ignore = readFileSync('.gitignore', 'utf8');
if (!ignore.includes('.env*') || !ignore.includes('!.env.example'))
  throw new Error('Secret ignore rules are missing.');
if (found.length)
  throw new Error(
    `Possible credential material in publishable/build files: ${found.join(', ')}. Values are not printed.`,
  );
console.log(
  `PASS: scanned ${files} source/build files; no configured keys or obvious key material found. This bounded check is not a comprehensive secret scanner.`,
);

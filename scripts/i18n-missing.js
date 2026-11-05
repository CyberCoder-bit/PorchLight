// Lists the interface text a catalog still needs, with the English to translate.
//   node scripts/i18n-missing.js es        -> missing keys for Spanish, as JSON
//   node scripts/i18n-missing.js es --all  -> every key, with the current text if any
// Used by translators: copy the output, translate the values, keep the keys and
// every {variable} exactly as they are.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EN } from '../src/i18n/index.js';

const [code, flag] = process.argv.slice(2);
if (!code) {
  console.error('Usage: node scripts/i18n-missing.js <code> [--all]');
  process.exit(1);
}
const file = path.resolve('src/i18n', `${code}.js`);
const catalog = fs.existsSync(file) ? (await import(pathToFileURL(file))).default : {};
const out = {};
for (const [key, english] of Object.entries(EN)) {
  if (flag === '--all') out[key] = { en: english, current: catalog[key] ?? null };
  else if (typeof catalog[key] !== 'string' || !catalog[key].trim()) out[key] = english;
}
const extra = Object.keys(catalog).filter((k) => !(k in EN));
console.log(JSON.stringify(out, null, 2));
console.error(`${code}: ${Object.keys(out).length} ${flag === '--all' ? 'keys' : 'missing'}, ${extra.length} unused (${extra.slice(0, 5).join(', ')})`);

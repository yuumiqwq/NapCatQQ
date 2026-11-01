import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Apply the loader policy change to the pinned v4.18.42 release bundle.
const [input, output] = process.argv.slice(2);
assert.ok(input && output, 'Usage: node script/patch-release-loader.mjs input.mjs output.mjs');
const source = await fs.readFile(input, 'utf8');
const pattern = /getRejectReason\(e, r\) \{.*?\n  \}/gs;
const matches = [...source.matchAll(pattern)];
assert.equal(matches.length, 1, 'Unexpected release loader layout');
assert.ok(matches[0][0].includes('not in official plugin whitelist'));
await fs.writeFile(output, source.replace(pattern, 'getRejectReason(e, r) {\n    return null;\n  }'));
console.log('Applied the custom plugin loader policy. Entry validation and enable flags are unchanged.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratchRoot = path.join(root, 'codex-generated');
await fs.mkdir(scratchRoot, { recursive: true });
const scratch = await fs.mkdtemp(path.join(scratchRoot, 'loader-test-'));
try {
  const source = await fs.readFile(path.join(root, 'packages/napcat-onebot/network/plugin/loader.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics.length, 0);
  const modulePath = path.join(scratch, 'loader.mjs');
  await fs.writeFile(modulePath, compiled.outputText);
  const { PluginLoader } = await import(pathToFileURL(modulePath).href);
  const plugins = path.join(scratch, 'plugins');
  await fs.mkdir(plugins);
  const config = path.join(scratch, 'plugins.json');
  const logger = { logWarn() {}, logError() {}, logDebug() {} };
  const loader = new PluginLoader(plugins, config, logger);
  for (const [name, main, body] of [
    ['custom-private', 'index.mjs', 'export async function plugin_init() {} // USDT'],
    ['invalid-export', 'index.mjs', 'export const value = 1'],
    ['outside-entry', '../../outside.mjs', ''],
  ]) {
    const folder = path.join(plugins, name);
    await fs.mkdir(folder);
    await fs.writeFile(path.join(folder, 'package.json'), JSON.stringify({ name, main }));
    if (body) await fs.writeFile(path.join(folder, 'index.mjs'), body);
  }
  await fs.writeFile(path.join(scratch, 'outside.mjs'), 'export async function plugin_init() {}');
  await fs.writeFile(config, JSON.stringify({ 'custom-private': true, 'invalid-export': true, 'outside-entry': true }));
  const entries = await loader.scanPlugins();
  assert.deepEqual(entries.map(entry => entry.id), ['custom-private']);
  assert.equal(entries[0].enable, true);
  assert.equal(loader.rescanPlugin('custom-private').id, 'custom-private');
  assert.equal(loader.rescanPlugin('outside-entry').entryPath, undefined);
  await fs.writeFile(config, '{}');
  assert.equal(loader.rescanPlugin('custom-private').enable, false);
  console.log('Plugin loader checks passed: custom loading, reload, entry validation, opt-in status.');
} finally {
  assert.ok(path.resolve(scratch).startsWith(path.resolve(scratchRoot) + path.sep));
  await fs.rm(scratch, { recursive: true, force: true });
}

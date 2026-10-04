// Development checks only. The shipped web app has no Node dependency.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { selfTestCode, codeBits, hexToSeed, seedToHex, levelFor } = await import(pathToFileURL(join(root, 'js/code.js')));
const { analyzeSignals, removeCut, syntheticSignals } = await import(pathToFileURL(join(root, 'js/analyze.js')));
selfTestCode();
assert.equal(seedToHex(hexToSeed('0000000a')), '0000000A');
assert.throws(() => hexToSeed('Z2345678'));
assert.equal(levelFor(-1, 0.1), 0.8);
assert.equal(levelFor(1, 0.1), 1);
const raw = syntheticSignals();
const original = analyzeSignals(raw.times, raw.bright, 0x12345678);
assert.equal(original.verdict, 'GO'); assert(original.z > 5); assert.equal(original.lagSeconds, 1);
const cutInput = removeCut(raw.times, raw.bright, 8, 9);
const cut = analyzeSignals(cutInput.times, cutInput.bright, 0x12345678);
assert.equal(cut.verdict, 'TAMPERED');
assert(cut.edits.some(e => Math.abs(e.boundaryTime - 8) <= 1.5 && e.shiftSeconds === -1));
assert.equal(analyzeSignals(raw.times, raw.bright, 0x3FA9C21B).verdict, 'NO-GO');
assert.equal(analyzeSignals(raw.times, raw.bright.map(() => 120), 0x12345678).verdict, 'NO-GO');
assert.throws(() => removeCut(raw.times, raw.bright, 9, 8));
assert.throws(() => removeCut(raw.times, raw.bright, 0, 25));
assert.throws(() => analyzeSignals([0, 1, 1], [2, 3, 4], 0));
assert.throws(() => analyzeSignals([0, 1], [2, 3], 0));
// Insert an unsealed second at 8 seconds, then retain the original signal.
const inserted = { times: [], bright: [] };
for (let i = 0; i < raw.times.length; i++) {
  if (i === 240) for (let j = 0; j < 30; j++) { inserted.times.push(8 + j / 30); inserted.bright.push(120); }
  inserted.times.push(raw.times[i] + (i >= 240 ? 1 : 0)); inserted.bright.push(raw.bright[i]);
}
const insertion = analyzeSignals(inserted.times, inserted.bright, 0x12345678);
assert.equal(insertion.verdict, 'TAMPERED'); assert(insertion.edits.some(e => e.shiftSeconds === 1));
for (const seconds of [10, 20, 30]) {
  const samples = syntheticSignals(0x12345678, seconds);
  assert.equal(analyzeSignals(samples.times, samples.bright, 0x12345678, seconds).verdict, 'GO');
}
const python = process.env.KASAM_PYTHON || 'python';
const source = `import json,sys\nsys.path.insert(0,'tools')\nimport kasam_check as k\nimport numpy as np\ndata=json.load(sys.stdin)\nout={'bits':[k.code_bits(seed,128).astype(int).tolist() for seed in data['seeds']], 'reports':[k.analyze(v['times'],v['bright'],0x12345678) for v in data['cases']]}\nprint(json.dumps(out))`;
const seeds = [0, 1, 0x12345678, 0xffffffff, 0x80000000];
const parity = spawnSync(python, ['-c', source], { cwd: root, input: JSON.stringify({ seeds, cases: [raw, cutInput, inserted] }), encoding: 'utf8' });
if (parity.status !== 0) throw new Error(`Python parity failed. Set KASAM_PYTHON to a Python executable with numpy.\n${parity.stderr}`);
const result = JSON.parse(parity.stdout);
result.bits.forEach((bits, i) => assert.deepEqual(bits, codeBits(seeds[i], 128)));
[original, cut, insertion].forEach((js, i) => {
  const py = result.reports[i]; assert.equal(py.verdict, js.verdict); assert(Math.abs(py.z - js.z) < 1e-10);
  assert.equal(py.lagSeconds, js.lagSeconds); assert.deepEqual(py.edits, js.edits);
  js.corr.forEach((value, index) => assert(Math.abs(value - py.corr[index]) < 1e-10));
});
// Catch broken local HTML/CSS/manifest/service-worker asset paths before deployment.
for (const name of ['index.html', 'seal.html', 'verify.html', 'light.html']) {
  const html = readFileSync(join(root, name), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="\.\/([^"?#]+)(?:[^\"]*)"/g)) assert(existsSync(join(root, match[1])), `${name}: missing ${match[1]}`);
}
const worker = readFileSync(join(root, 'sw.js'), 'utf8');
for (const match of worker.matchAll(/'\.\/([^']*)'/g)) if (match[1]) assert(existsSync(join(root, match[1])), `SW: missing ${match[1]}`);
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
manifest.icons.forEach(icon => assert(existsSync(join(root, icon.src))));
console.log('PASS: PRNG parity (5 seeds × 128 bits); GO / cut / insertion / wrong code / flat signal; input validation; 10/20/30 seconds; Python score parity; asset paths.');
console.log(JSON.stringify({ original: { verdict: original.verdict, z: original.z }, cut: { verdict: cut.verdict, z: cut.z, edits: cut.edits }, insertion: { verdict: insertion.verdict, z: insertion.z, edits: insertion.edits } }, null, 2));

/* ============================================================
 * Metadata Remove Pro Web - P3 HEIC scan tests (pure-JS, no wasm)
 * node tests/heic.test.mjs
 * ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// heic.js 依赖 MRPVideo.isoWalk 与 MRPEngine.parseTiff
require('../js/core/engine.js');
require('../js/core/video.js');
const H = require('../js/optional/heic.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = path.resolve(HERE, '..', '..', '测试样本');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail != null ? '  | ' + JSON.stringify(detail).slice(0, 160) : '')); }
}

const heicPath = path.join(SAMPLE_DIR, 'iphone示例.heic');
if (!existsSync(heicPath)) {
  check('HEIC 样本存在(先运行 make_samples.py)', false, heicPath);
} else {
  const data = new Uint8Array(readFileSync(heicPath));
  const scan = H.scanHeic(data);
  check('HEIC: 提取 EXIF 元数据', scan.metadata.some(m => m.name === 'Make' || m.name === 'Model'), scan.metadata.map(m => m.name));
  check('HEIC: 检出 iPhone 型号', scan.metadata.some(m => m.value === 'iPhone 15 Pro Max'), scan.metadata.filter(m => m.name === 'Model'));
  check('HEIC: AI 标记检出(AI-Generated)', scan.findings.some(f => f.kind === 'ai_flag'), scan.findings.map(f => f.kind));
  check('HEIC: 裁决 medium(与桌面版一致)', scan.verdict === 'medium', scan.verdict);
  check('HEIC: 尺寸 640x640', scan.width === 640 && scan.height === 640, [scan.width, scan.height]);
}
// 非 HEIC 输入
{
  const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  const scan = H.scanHeic(junk);
  check('HEIC: 非 HEIC 输入返回干净空结果', scan.verdict === 'clean' && scan.metadata.length === 0, scan.verdict);
}

console.log('');
console.log('passed: ' + passed + '  failed: ' + failed);
if (failed) process.exit(1);

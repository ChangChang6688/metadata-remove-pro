// 隐形水印检测跨引擎对照: Python 引擎判定 sd水印示例.png 为 detected(0.747, SDXL 48位)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const A = require('../js/core/antiwm.js');

const dir = dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(readFileSync(join(dir, 'fixtures/sdwm.meta.json'), 'utf8'));
const rgb = new Uint8Array(readFileSync(join(dir, 'fixtures/sdwm.rgba')));
const rgba = new Uint8Array(meta.w * meta.h * 4);
for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
  rgba[j] = rgb[i]; rgba[j + 1] = rgb[i + 1]; rgba[j + 2] = rgb[i + 2]; rgba[j + 3] = 255;
}

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail != null ? '  | ' + String(detail).slice(0, 120) : ''));
  if (!cond) fails++;
}
const r = A.detectInvisible(rgba, meta.w, meta.h);
check('水印样本: 检出', r.status === 'detected', JSON.stringify(r));
check('水印样本: 强度接近 Python 引擎(0.74±0.05)', Math.abs(r.ratio - 0.747) < 0.05, r.ratio);
check('水印样本: 命中 SDXL 48 位消息', r.hit.indexOf('SDXL') >= 0, r.hit);

// 干净样本(白底产品图)不误报
import { spawnSync } from 'node:child_process';
console.log('');
console.log(fails === 0 ? '== 全部通过 ==' : '== ' + fails + ' 项失败 ==');
process.exit(fails ? 1 : 0);

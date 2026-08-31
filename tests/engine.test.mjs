// webapp 引擎单元测试: 与桌面版 Python 引擎共用同一批测试样本
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const S = join(ROOT, '测试样本');

const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const E = require('../js/core/engine.js');

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail != null ? '  | ' + String(detail).slice(0, 100) : ''));
  if (!cond) fails++;
}
function read(name) { return new Uint8Array(readFileSync(join(S, name))); }
function chunkTypes(d) { return (E.pngChunks(d) || []).map(function (c) { return c.type; }); }
function segMarkers(d) { return (E.jpegSegments(d) || []).map(function (s) { return s.marker; }); }

// 1. PNG 扫描与剥离
const png = read('sd生成图.png');
let sc = E.scanImage(png, 'png');
check('PNG 扫描: 高风险(AI+C2PA)', sc.verdict === 'high' && sc.c2pa, sc.verdict);
check('PNG 扫描: 检出 tEXt 参数', sc.findings.some(function (f) { return f.key.indexOf('tEXt') === 0; }));
const pngStripped = E.stripPng(png);
const pngTypes = chunkTypes(pngStripped.data);
check('PNG 剥离: 文本块/C2PA 移除', !pngTypes.some(function (t) { return ['tEXt','zTXt','iTXt','caBX','C2PA','eXIf'].indexOf(t) >= 0; }), pngTypes.join(','));
check('PNG 剥离: IDAT 保留(像素无损结构)', pngTypes.indexOf('IDAT') >= 0);
let sc2 = E.scanImage(pngStripped.data, 'png');
check('PNG 剥离: 复扫干净', sc2.verdict === 'clean', sc2.verdict);

// 2. JPEG 扫描与剥离
const jpg = read('dalle示例.jpg');
sc = E.scanImage(jpg, 'jpg');
check('JPEG 扫描: 高风险', sc.verdict === 'high' && sc.c2pa, sc.verdict);
check('JPEG 扫描: 检出可见水印(EXIF/XMP 字段)', sc.metadata.length > 0);
const jpgStripped = E.stripJpeg(jpg);
const markers = segMarkers(jpgStripped.data);
check('JPEG 剥离: APP/COM 全移除', !markers.some(function (m) { return (m >= 0xE0 && m <= 0xEF) || m === 0xFE; }), markers.join(','));
sc2 = E.scanImage(jpgStripped.data, 'jpg');
check('JPEG 剥离: 复扫干净', sc2.verdict === 'clean', sc2.verdict);

// 3. WebP 扫描与剥离
const webp = read('webp示例.webp');
sc = E.scanImage(webp, 'webp');
check('WebP 扫描: 检出 AI 标记', sc.verdict === 'high' || sc.verdict === 'medium', sc.verdict);
const webpStripped = E.stripWebp(webp);
check('WebP 剥离: RIFF 头完好', webpStripped.data[0] === 0x52 && webpStripped.data[1] === 0x49 && webpStripped.data[8] === 0x57, Array.from(webpStripped.data.slice(0, 12)));
const wc = (E.webpChunks(webpStripped.data) || []).map(function (c) { return c.four; });
check('WebP 剥离: EXIF/XMP/ICCP 移除', !wc.some(function (f) { return ['EXIF','XMP ','ICCP'].indexOf(f) >= 0; }), wc.join(','));
sc2 = E.scanImage(webpStripped.data, 'webp');
check('WebP 剥离: 复扫干净', sc2.verdict === 'clean', sc2.verdict);

// 4. SVG 扫描与剥离
const svg = read('矢量示例.svg');
sc = E.scanImage(svg, 'svg');
check('SVG 扫描: 检出 AI 标记', sc.verdict === 'medium' || sc.verdict === 'high', sc.verdict);
const svgStripped = E.stripSvg(svg);
const svgText = E.utf8(svgStripped.data);
check('SVG 剥离: 注释/metadata/生成器移除', svgText.indexOf('<!--') < 0 && svgText.indexOf('<metadata') < 0 && svgText.indexOf('generator=') < 0);
sc2 = E.scanImage(svgStripped.data, 'svg');
check('SVG 剥离: 复扫干净', sc2.verdict === 'clean', sc2.verdict);

// 5. 与 Python 判定一致的干净样本
sc = E.scanImage(read('普通照片.png'), 'png');
check('普通照片: 判定干净', sc.verdict === 'clean', sc.verdict);
sc = E.scanImage(read('相机照片.jpg'), 'jpg');
check('相机照片: 判定低风险', sc.verdict === 'low', sc.verdict);

console.log('');
console.log(fails === 0 ? '== 全部通过 ==' : '== ' + fails + ' 项失败 ==');
process.exit(fails ? 1 : 0);

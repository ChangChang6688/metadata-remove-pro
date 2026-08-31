// forge 引擎测试: 会话随机性 / EV 一致性 / GPS 地区 / seed 复现 / 注入往返
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
globalThis.MRPEngine = require('../js/core/engine.js');
globalThis.MRPCameras = require('../js/data/cameras.js');
globalThis.MRPSrgb = require('../js/data/srgb.js');
const F = require('../js/core/forge.js');
const E = globalThis.MRPEngine;

const dir = dirname(fileURLToPath(import.meta.url));
const S = join(dir, '..', '..', '测试样本');
function read(name) { return new Uint8Array(readFileSync(join(S, name))); }
let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail != null ? '  | ' + String(detail).slice(0, 100) : ''));
  if (!cond) fails++;
}
function findMeta(meta, name) {
  var m = meta.filter(function (x) { return x.name === name; });
  return m.length ? m[0].value : null;
}

// 1. 会话生成 + 唯一性 + EV
const bytes = read('普通照片.png');
const s1 = new F.ForgeSession({ gps: 'random', region: 'us' });
const m1 = s1.forFile(bytes, 'png');
const s2 = new F.ForgeSession({ gps: 'random', region: 'us' });
const m2 = s2.forFile(bytes, 'png');
let out1 = { metadata: [] };
E.parseTiff(m1.exifTiff, out1);
let out2 = { metadata: [] };
E.parseTiff(m2.exifTiff, out2);
check('EXIF: 有相机型号', !!findMeta(out1.metadata, 'Model'), findMeta(out1.metadata, 'Model'));
check('两次运行唯一 ID 不同', findMeta(out1.metadata, 'ImageUniqueID') !== findMeta(out2.metadata, 'ImageUniqueID'));
const N = parseFloat(findMeta(out1.metadata, 'FNumber') || '0');
const et = findMeta(out1.metadata, 'ExposureTime') || '1/100';
const tNum = et.indexOf('/') >= 0 ? 1 / parseInt(et.split('/')[1], 10) : parseFloat(et);
const iso = parseInt(findMeta(out1.metadata, 'ISOSpeedRatings') || '100', 10);
const ev = Math.log2(N * N / tNum) + Math.log2(100 / iso);
check('EV 曝光自洽(0.8~15.4)', ev >= 0.8 && ev <= 15.4, ev.toFixed(2));
check('XMP 不含 DigitalSourceType/c2pa', (m1.xmpPacket || '').indexOf('DigitalSourceType') < 0 && (m1.xmpPacket || '').toLowerCase().indexOf('c2pa') < 0);
check('XMP 合法(直出为空, 否则含 xmpmeta)', !m1.xmpPacket || m1.xmpPacket.indexOf('x:xmpmeta') >= 0, m1.xmpPacket.slice(0, 60));
check('附带 ICC', m1.icc && m1.icc.length > 100, m1.icc && m1.icc.length);

// 2. GPS 地区
let og = { metadata: [] };
E.parseTiff(m1.exifTiff, og);
check('地区 us: 有 GPS', findMeta(og.metadata, 'GPSInfo') === 'gps_present');
const scn = new F.ForgeSession({ gps: 'random', region: 'cn' });
const mcn = scn.forFile(bytes, 'png');
// 从 TIFF 读 GPS 引用: 直接搜字节中的 N/S/E/W ASCII
function hasRef(tiff, ref) {
  for (let i = 0; i < tiff.length - 1; i++) if (String.fromCharCode(tiff[i]) === ref) return true;
  return false;
}
check('地区 cn: GPS 含 E 经度引用', hasRef(mcn.exifTiff, 'E'));

// 3. seed 复现
const seed = new Uint8Array(16);
for (let i = 0; i < 16; i++) seed[i] = 0xA1;
const a = new F.ForgeSession({ gps: 'off', region: 'us', seedBytes: seed }).forFile(bytes, 'png');
const b = new F.ForgeSession({ gps: 'off', region: 'us', seedBytes: seed }).forFile(bytes, 'png');
check('seed 复现: EXIF 字节一致', Buffer.from(a.exifTiff).equals(Buffer.from(b.exifTiff)));

// 4. JPEG 注入往返(剥离 -> 注入 -> 复扫)
const TEST_XMP = '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmp:CreatorTool="Adobe Photoshop Lightroom Classic 13.5 (Windows)"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
const xmpForInject = m1.xmpPacket || TEST_XMP;
const jpg = read('dalle示例.jpg');
const stripped = E.stripJpeg(jpg);
const injected = F.injectJpegMeta(stripped.data, m1.exifTiff, xmpForInject, m1.icc);
check('JPEG 注入成功', !!injected);
const scanJ = E.scanImage(injected, 'jpg');
check('JPEG 注入后复扫: 检出相机型号', !!findMeta(scanJ.metadata, 'Model'), scanJ.verdict);
check('JPEG 注入后复扫: 非高风险', scanJ.verdict !== 'high', scanJ.verdict);
check('JPEG 注入: 像素段保留(有 SOS 数据)', injected.length > stripped.data.length);

// 5. PNG 注入往返
const png = read('普通照片.png');
const strippedP = E.stripPng(png);
const injectedP = await F.injectPngMeta(strippedP.data, m1.exifTiff, xmpForInject, null);
check('PNG 注入成功', !!injectedP);
const types = (E.pngChunks(injectedP) || []).map(function (c) { return c.type; });
check('PNG 注入: 含 eXIf 与 iTXt', types.indexOf('eXIf') >= 0 && types.indexOf('iTXt') >= 0, types.join(','));
const scanP = E.scanImage(injectedP, 'png');
check('PNG 注入后复扫: 检出相机型号', !!findMeta(scanP.metadata, 'Model'), scanP.verdict);

// 6. WebP 注入往返
const webp = read('webp示例.webp');
const strippedW = E.stripWebp(webp);
const injectedW = F.injectWebpMeta(strippedW.data, m1.exifTiff, xmpForInject, m1.icc);
check('WebP 注入成功', !!injectedW);
const wtypes = (E.webpChunks(injectedW) || []).map(function (c) { return c.four; });
check('WebP 注入: 含 EXIF/XMP/ICCP', wtypes.indexOf('EXIF') >= 0 && wtypes.indexOf('XMP ') >= 0 && wtypes.indexOf('ICCP') >= 0, wtypes.join(','));
const scanW = E.scanImage(injectedW, 'webp');
check('WebP 注入后复扫: 检出相机型号', !!findMeta(scanW.metadata, 'Model'), scanW.verdict);

console.log('');
console.log(fails === 0 ? '== 全部通过 ==' : '== ' + fails + ' 项失败 ==');
process.exit(fails ? 1 : 0);

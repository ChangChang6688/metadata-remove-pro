/* ============================================================
 * Metadata Remove Pro Web - P3 video container tests
 * node tests/video.test.mjs
 * ============================================================ */
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const V = require('../js/core/video.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = path.resolve(HERE, '..', '..', '测试样本');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail ? '  | ' + JSON.stringify(detail).slice(0, 160) : '')); }
}

/* ---------- 构造工具 ---------- */
function be32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, false); return b; }
function le32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; }
function u32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function cc(b, o) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]); }
function concat(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
function box(type, payload) { return concat([be32(8 + payload.length), new TextEncoder().encode(type), payload]); }
function str(b) { return new TextDecoder().decode(b); }
function enc(s) { return new TextEncoder().encode(s); }
function vint(b, o) {
  const first = b[o]; let mask = 0x80, len = 1;
  while (len <= 8 && !(first & mask)) { mask >>= 1; len++; }
  let v = first & (mask - 1);
  for (let i = 1; i < len; i++) v = v * 256 + b[o + i];
  const canon = (v + ((0x80 << (7 * (len - 1))) >>> 0)) >>> 0;
  return { value: v, len, canon };
}
function ebmlElem(idBytes, payload) {
  // idBytes: 原始 ID 字节; 自动用最小 vint 编码尺寸
  const len = vintSizeOf(payload.length);
  const sz = new Uint8Array(len);
  let v = payload.length;
  for (let j = len - 1; j >= 0; j--) { sz[j] = v & 0xFF; v = Math.floor(v / 256); }
  sz[0] |= 0x80 >> (len - 1);
  return concat([idBytes, sz, payload]);
}
function vintSizeOf(value) {
  let len = 1;
  while (value > Math.pow(2, 7 * len) - 1) len++;
  return len;
}
function ebmlId(canon) {
  // 输入为标准 matroska 元素 ID(首字节含长度标记, 如 0x18538067), 还原为 vint 字节
  // 注意: 必须从最高位标记开始判断(2 字节 ID 的低字节也可能含 0x80)
  let len;
  if (canon & 0x10000000) len = 4;
  else if (canon & 0x200000) len = 3;
  else if (canon & 0x4000) len = 2;
  else len = 1;
  const out = new Uint8Array(len);
  let v = canon;
  for (let j = len - 1; j >= 0; j--) { out[j] = v & 0xFF; v = Math.floor(v / 256); }
  return out;
}
const ID_SEGMENT = ebmlId(0x18538067);
const ID_INFO = ebmlId(0x1549A966);
const ID_TAGS = ebmlId(0x1254C367);
const ID_TAG = ebmlId(0x7373);
const ID_SIMPLETAG = ebmlId(0x67C8);
const ID_TITLE = ebmlId(0x7BA9);
const ID_TAGNAME = ebmlId(0x45A3);
const ID_TAGSTRING = ebmlId(0x4487);
const ID_VOID = new Uint8Array([0xEC]);

function makeIso() {
  // ftyp + moov(mvhd + trak(tkhd + stco) + udta(meta(ilst(©nam)))) + mdat
  const ftyp = box('ftyp', concat([enc('isom'), be32(0x200), enc('isomiso2avc1mp41')]));
  const mvhd = box('mvhd', concat([
    new Uint8Array([0, 0, 0, 0]), // version/flags
    be32(0), be32(0),           // creation, modification
    be32(1000),                 // timescale
    be32(3000),                 // duration => 3s
    be32(0x00010000),           // rate
    new Uint8Array(4),          // volume(2)+reserved(2)
    new Uint8Array(8),          // reserved
    new Uint8Array(36),         // matrix
    new Uint8Array(24),         // predefined
    be32(2),                    // next_track_ID
  ]));
  const tkhd = box('tkhd', concat([
    new Uint8Array([0, 0, 0, 0x07]), be32(0), be32(0), be32(1), be32(0), be32(3000),
    new Uint8Array(8), new Uint8Array(2), new Uint8Array(2), new Uint8Array(2), new Uint8Array(2),
    new Uint8Array(36), be32(640 << 16), be32(360 << 16),
  ]));
  const stco = box('stco', concat([new Uint8Array([0, 0, 0, 0]), be32(1), be32(0xDEADBEEF)]));
  const stbl = box('stbl', stco);
  const minf = box('minf', stbl);
  const mdia = box('mdia', minf);
  const trak = box('trak', concat([tkhd, mdia]));
  const dataBox = box('data', concat([be32(0), be32(1), be32(0), enc('Runway Gen-3 demo video')]));
  // '©nam' 必须为 4 字节 latin1: 0xA9 0x6E 0x61 0x6D
  const cnamBox = concat([be32(8 + dataBox.length), new Uint8Array([0xA9, 0x6E, 0x61, 0x6D]), dataBox]);
  const ilst = box('ilst', cnamBox);
  const keyStr = enc('com.apple.quicktime.title'); // 25 字节
  const keys = box('keys', concat([be32(0), be32(1), be32(8 + keyStr.length), new Uint8Array([0x6D, 0x64, 0x74, 0x61]), keyStr]));
  const hdlr = box('hdlr', concat([be32(0), be32(0), new Uint8Array([0x6D, 0x64, 0x74, 0x61]), new Uint8Array(12)]));
  const meta = box('meta', concat([new Uint8Array([0, 0, 0, 0]), hdlr, keys, ilst]));
  const udta = box('udta', meta);
  const moov = box('moov', concat([mvhd, trak, udta]));
  const mdat = box('mdat', new Uint8Array(32).fill(0xAB));
  return concat([ftyp, moov, mdat]);
}

function makeEbml() {
  const title = ebmlElem(ID_TITLE, enc('AI generated video'));
  const info = ebmlElem(ID_INFO, title);
  const tagName = ebmlElem(ID_TAGNAME, enc('TITLE'));
  const tagString = ebmlElem(ID_TAGSTRING, enc('Generated with Sora'));
  const simpleTag = ebmlElem(ID_SIMPLETAG, concat([tagName, tagString]));
  const tag = ebmlElem(ID_TAG, simpleTag);
  const tags = ebmlElem(ID_TAGS, tag);
  const segment = ebmlElem(ID_SEGMENT, concat([info, tags]));
  const ebmlHeader = ebmlElem(ebmlId(0x1A45DFA3), concat([ebmlElem(ebmlId(0x4286), new Uint8Array([1])), new Uint8Array(32).fill(0)]));
  return concat([ebmlHeader, segment]);
}

function makeAvi() {
  const avih = concat([le32(40000), le32(0), le32(0), le32(0), le32(100), le32(0), le32(1), le32(0), le32(640), le32(360), le32(0), le32(0), le32(0), le32(0)]);
  const avihChunk = concat([enc('avih'), le32(avih.length), avih]);
  const hdrl = concat([enc('LIST'), le32(4 + avihChunk.length), enc('hdrl'), avihChunk]);
  const inamPayload = enc('AI video\0'); // 9 字节
  const inam = concat([enc('INAM'), le32(inamPayload.length), inamPayload, new Uint8Array(inamPayload.length & 1)]);
  const isftPayload = enc('Lavf\0'); // 5 字节
  const isft = concat([enc('ISFT'), le32(isftPayload.length), isftPayload, new Uint8Array(isftPayload.length & 1)]);
  const info = concat([enc('LIST'), le32(4 + inam.length + isft.length), enc('INFO'), inam, isft]);
  const movi = concat([enc('LIST'), le32(4 + 4), enc('movi'), new Uint8Array(4)]);
  const body = concat([enc('AVI '), hdrl, info, movi]);
  const riff = concat([enc('RIFF'), le32(body.length), body]);
  return riff;
}

/* ================= 1. Void 头构造 ================= */
console.log('== Void header ==');
for (let total = 2; total <= 300; total += 7) {
  const head = V.voidHeader(total);
  assert.ok(head, 'voidHeader(' + total + ')');
  assert.strictEqual(head[0], 0xEC);
  const parsed = vint(head, 1);
  assert.strictEqual(parsed.len + 1, head.length, 'vint len ' + total);
  assert.strictEqual(parsed.value, total - head.length, 'void size ' + total);
}
check('Void 头: 2..300 字节长度全部精确', true);
check('Void 头: 头字节为 0xEC', true);

/* ================= 2. ISOBMFF 扫描 ================= */
console.log('== ISO scan ==');
{
  const iso = makeIso();
  const scan = V.scanVideo(iso, 'mp4');
  const names = scan.metadata.map(m => m.name);
  check('ISO: 识别为 isobmff', scan.kind === 'isobmff');
  check('ISO: 标题被读出', scan.metadata.some(m => m.name === 'mp4_title' && String(m.value).indexOf('Runway Gen-3') >= 0), scan.metadata);
  check('ISO: 尺寸 640x360', scan.width === 640 && scan.height === 360, [scan.width, scan.height]);
  check('ISO: 时长 3s', scan.duration === 3, scan.duration);
  check('ISO: 分类为 AI', scan.findings.some(f => f.kind === 'ai'), scan.findings);
  check('ISO: 裁决高风险', scan.verdict === 'high', scan.verdict);
  check('ISO: keys 元数据被读出', names.indexOf('mp4_keys') >= 0 && names.indexOf('mp4_mdta_handler') >= 0, names);
}

/* ================= 3. ISOBMFF 剥离(保偏移) ================= */
console.log('== ISO strip ==');
{
  const iso = makeIso();
  const before = Buffer.from(iso);
  const r = V.stripVideo(iso, 'mp4');
  check('ISO strip: 有输出', !!r.data && r.kind === 'isobmff', r.kind);
  check('ISO strip: 长度不变', r.data && r.data.length === iso.length, [r.data && r.data.length, iso.length]);
  check('ISO strip: 移除 udta', (r.removed || []).indexOf('MP4:udta') >= 0, r.removed);
  // 定位 udta 原位置
  let udtaPos = -1;
  V.isoWalk(iso, (t, p, s) => { if (t === 'udta' && udtaPos < 0) { udtaPos = p; return false; } return true; });
  check('ISO strip: udta 变为 free', r.data && cc(r.data, udtaPos) === 'free', r.data && cc(r.data, udtaPos));
  check('ISO strip: mdat 数据不变', r.data && Buffer.from(r.data.subarray(iso.length - 32)).equals(before.subarray(iso.length - 32)));
  // stco 偏移量字节必须原样保留(其位于 moov 内, 位置不变)
  // 精确验证: 只允许 udta 区域内差异
  let udtaSize = 0;
  V.isoWalk(iso, (t, p, s) => { if (t === 'udta') { udtaSize = s; return false; } return true; });
  let okDiff = true;
  for (let i = 0; i < iso.length; i++) {
    const inside = i >= udtaPos && i < udtaPos + udtaSize;
    if (r.data[i] !== iso[i] && !inside) { okDiff = false; break; }
  }
  check('ISO strip: 仅 udta 区域字节被修改', okDiff);
  check('ISO strip: 盒结构完整解析', (() => {
    let last = 0;
    V.isoWalk(r.data, (t, p, s) => { last = Math.max(last, p + s); return true; });
    return last === r.data.length;
  })());
  const scan2 = V.scanVideo(r.data, 'mp4');
  check('ISO strip: 复扫无元数据', scan2.metadata.length === 0, scan2.metadata);
  check('ISO strip: 复扫裁决干净', scan2.verdict === 'clean', scan2.verdict);
}

/* ================= 4. EBML 扫描 ================= */
console.log('== EBML scan ==');
{
  const ebml = makeEbml();
  const scan = V.scanVideo(ebml, 'webm');
  check('EBML: 识别为 ebml', scan.kind === 'ebml');
  check('EBML: Title 读出', scan.metadata.some(m => m.name === 'mkv_title' && String(m.value) === 'AI generated video'), scan.metadata);
  check('EBML: Tag 读出并分类 AI', scan.findings.some(f => f.kind === 'ai' && String(f.value).indexOf('Sora') >= 0), scan.findings);
  check('EBML: 裁决高风险', scan.verdict === 'high', scan.verdict);
}

/* ================= 5. EBML 剥离(保偏移) ================= */
console.log('== EBML strip ==');
{
  const ebml = makeEbml();
  const r = V.stripVideo(ebml, 'webm');
  check('EBML strip: 有输出', !!r.data, r.kind);
  check('EBML strip: 长度不变', r.data && r.data.length === ebml.length, [r.data && r.data.length, ebml.length]);
  check('EBML strip: 移除 Tags+Title', (r.removed || []).indexOf('MKV:Tags') >= 0 && (r.removed || []).indexOf('MKV:Title') >= 0, r.removed);
  // EBML 头必须原样(前 32 字节结构不变, 除 Segment 内)
  const segStart = (() => {
    let pos = 0;
    while (pos + 2 <= ebml.length) {
      const id = vint(ebml, pos); const sp = vint(ebml, pos + id.len);
      if (id.canon === 0x18538067) return pos;
      pos += id.len + sp.len + sp.value;
      if (pos <= 0) break;
    }
    return -1;
  })();
  check('EBML strip: Segment 前字节不变', segStart > 0 && Buffer.from(r.data.subarray(0, segStart)).equals(Buffer.from(ebml.subarray(0, segStart))));
  const scan2 = V.scanVideo(r.data, 'webm');
  check('EBML strip: 复扫无标题/标签', scan2.metadata.length === 0 && scan2.findings.length === 0, [scan2.metadata, scan2.findings]);
  check('EBML strip: 复扫裁决干净', scan2.verdict === 'clean', scan2.verdict);
}

/* ================= 6. RIFF 扫描 ================= */
console.log('== RIFF scan ==');
{
  const avi = makeAvi();
  const scan = V.scanVideo(avi, 'avi');
  check('RIFF: 识别为 riff', scan.kind === 'riff');
  check('RIFF: 标题读出', scan.metadata.some(m => m.name === 'avi_title' && String(m.value) === 'AI video'), scan.metadata);
  check('RIFF: 编码器读出', scan.metadata.some(m => m.name === 'avi_encoder'), scan.metadata);
  check('RIFF: 尺寸 640x360', scan.width === 640 && scan.height === 360, [scan.width, scan.height]);
  check('RIFF: 时长 4s', scan.duration === 4, scan.duration);
}

/* ================= 7. RIFF 剥离(保偏移) ================= */
console.log('== RIFF strip ==');
{
  const avi = makeAvi();
  const r = V.stripVideo(avi, 'avi');
  check('RIFF strip: 有输出', !!r.data);
  check('RIFF strip: 长度不变', r.data && r.data.length === avi.length, [r.data && r.data.length, avi.length]);
  // 定位 INFO
  let infoPos = -1;
  V.riffWalk(avi, (id, lt, p) => { if (id === 'LIST' && lt === 'INFO') { infoPos = p; return false; } return true; });
  check('RIFF strip: INFO 变为 JUNK', r.data && cc(r.data, infoPos) === 'JUNK', r.data && cc(r.data, infoPos));
  const scan2 = V.scanVideo(r.data, 'avi');
  check('RIFF strip: 复扫无元数据', scan2.metadata.length === 0, scan2.metadata);
  check('RIFF strip: 复扫裁决干净', scan2.verdict === 'clean', scan2.verdict);
}

/* ================= 8. 真实样本 ai视频.mp4 ================= */
console.log('== real ai视频.mp4 ==');
const mp4Path = path.join(SAMPLE_DIR, 'ai视频.mp4');
if (existsSync(mp4Path)) {
  const data = new Uint8Array(readFileSync(mp4Path));
  const scan = V.scanVideo(data, 'mp4');
  check('真实: 容器识别', scan.kind === 'isobmff', scan.kind);
  check('真实: C2PA/字符串检出', scan.c2pa === true, scan.c2pa);
  check('真实: 元数据非空', scan.metadata.length > 0, scan.metadata.length);
  check('真实: AI 痕迹检出(Runway)', scan.findings.some(f => f.kind === 'ai'), scan.findings.map(f => f.key));
  check('真实: 高风险裁决', scan.verdict === 'high', scan.verdict);
  check('真实: 尺寸 640x360', scan.width === 640 && scan.height === 360, [scan.width, scan.height]);
  check('真实: 时长约 3s', scan.duration >= 2.9 && scan.duration <= 3.1, scan.duration);
  const r = V.stripVideo(data, 'mp4');
  check('真实: 剥离有输出且长度不变', !!r.data && r.data.length === data.length, [!!r.data, r.data && r.data.length, data.length]);
  check('真实: 移除 MP4:udta 或 MP4:meta', (r.removed || []).length > 0, r.removed);
  const scan2 = V.scanVideo(r.data, 'mp4');
  check('真实: 剥离后无 C2PA 字节', scan2.c2pa === false, scan2.c2pa);
  check('真实: 剥离后元数据清空', scan2.metadata.length === 0, scan2.metadata);
  check('真实: 剥离后裁决干净或低风险', scan2.verdict === 'clean' || scan2.verdict === 'low', scan2.verdict);
  check('真实: 剥离后尺寸/时长保留', scan2.width === 640 && scan2.height === 360 && scan2.duration === scan.duration, [scan2.width, scan2.height, scan2.duration]);
} else {
  check('真实样本存在(先运行 make_samples.py)', false, mp4Path);
}

/* ================= 8.5 真实样本 mkv/webm/avi(需 make_samples.py) ================= */
console.log('== real mkv/webm/avi ==');
for (const spec of [
  { file: 'ai示例.mkv', ext: 'mkv', title: 'AI生成视频MKV', sig: 'sora', kind: 'ebml' },
  { file: 'ai示例.webm', ext: 'webm', title: 'AI视频WebM', sig: 'veo', kind: 'ebml' },
  { file: 'ai示例.avi', ext: 'avi', title: 'AI视频AVI', sig: 'kling', kind: 'riff' },
]) {
  const p = path.join(SAMPLE_DIR, spec.file);
  if (!existsSync(p)) {
    check('真实样本存在: ' + spec.file + '(先运行 make_samples.py)', false, p);
    continue;
  }
  const data = new Uint8Array(readFileSync(p));
  const scan = V.scanVideo(data, spec.ext);
  check(spec.file + ': 容器识别 ' + spec.kind, scan.kind === spec.kind, scan.kind);
  check(spec.file + ': 标题读出', scan.metadata.some(m => (m.name === 'mkv_title' || m.name === 'avi_title') && String(m.value).indexOf(spec.title) >= 0), scan.metadata.filter(m => m.name.indexOf('title') >= 0));
  check(spec.file + ': AI 痕迹检出(' + spec.sig + ')', scan.findings.some(f => f.kind === 'ai'), scan.findings.map(f => f.key));
  check(spec.file + ': 裁决高风险', scan.verdict === 'high', scan.verdict);
  check(spec.file + ': 尺寸 320x240', scan.width === 320 && scan.height === 240, [scan.width, scan.height]);
  check(spec.file + ': 时长约 2s', scan.duration >= 1.9 && scan.duration <= 2.1, scan.duration);
  const r = V.stripVideo(data, spec.ext);
  check(spec.file + ': 剥离有输出且长度不变', !!r.data && r.data.length === data.length, [!!r.data, r.data && r.data.length, data.length]);
  check(spec.file + ': 有移除项', (r.removed || []).length > 0, r.removed);
  const scan2 = V.scanVideo(r.data, spec.ext);
  const noTitle = !scan2.metadata.some(m => (m.name === 'mkv_title' || m.name === 'avi_title') || m.name === 'mkv_tag' || m.name === 'avi_comment' || m.name === 'avi_encoder' || m.name === 'mkv_tag_names');
  check(spec.file + ': 剥离后无标题/标签/注释', noTitle, scan2.metadata);
  check(spec.file + ': 剥离后尺寸保留', scan2.width === 320 && scan2.height === 240, [scan2.width, scan2.height]);
}

/* ================= 9. 非视频输入 ================= */
{
  const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  check('非视频: 识别为 null', V.detectKind(junk) === null, V.detectKind(junk));
  check('非视频: strip 返回空', V.stripVideo(junk, 'bin').data === null);
  const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  check('WebP 不误判为 AVI', V.detectKind(webpHeader) === null, V.detectKind(webpHeader));
}

console.log('');
console.log('passed: ' + passed + '  failed: ' + failed);
if (failed) process.exit(1);

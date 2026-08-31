/* ============================================================
 * Metadata Remove Pro Web - HEIC support (optional, lazy)
 * 1) scanHeic: 纯 JS, 无需 wasm — 解析 ISOBMFF meta(iloc/iinf/idat)
 *    提取 Exif item 交给 MRPEngine.parseTiff, 另做 C2PA 字节扫描
 * 2) decode: 懒加载 libheif.js + libheif.wasm(优先 fetch, file://
 *    回退到内嵌 base64 脚本) 解码为 RGBA, 供深度管线转 JPEG
 * Copyright (c) 2026. All rights reserved.
 * ============================================================ */
(function (root) {
  'use strict';

  var SCRIPT_URL = 'js/optional/vendor/libheif.js';
  var WASM_URL = 'js/optional/vendor/libheif.wasm';
  var B64_SCRIPT_URL = 'js/optional/vendor/libheif.wasm.b64.js';

  function u16(b, o) { return (b[o] << 8) | b[o + 1]; }
  function u32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
  function latin1(b, o, n) { var s = ''; for (var i = o; i < o + n; i++) s += String.fromCharCode(b[i]); return s; }
  function indexOfBytes(haystack, needle) {
    var nl = needle.length;
    if (!nl || haystack.length < nl) return -1;
    outer: for (var i = 0; i <= haystack.length - nl; i++) {
      for (var j = 0; j < nl; j++) if (haystack[i + j] !== needle.charCodeAt(j)) continue outer;
      return i;
    }
    return -1;
  }

  /* ---------- 纯 JS HEIC 扫描 ---------- */
  function scanHeic(data) {
    var out = { verdict: 'clean', findings: [], metadata: [], c2pa: false, width: 0, height: 0 };
    if (!data || data.length < 12) return out;
    var markers = ['c2pa', 'jumd', 'JUMBF'];
    for (var m = 0; m < markers.length; m++) {
      if (indexOfBytes(data.subarray(0, Math.min(data.length, 64 * 1024 * 1024)), markers[m]) >= 0) {
        out.c2pa = true;
        out.findings.push({ key: 'byte_stream', value: 'found_marker', kind: 'c2pa', arg: markers[m] });
        break;
      }
    }
    var V = root.MRPVideo;
    if (!V || typeof V.isoWalk !== 'function') return out;
    var infe = [], iloc = [], idat = null;
    try {
      V.isoWalk(data, function (type, pos, size, hdr, path) {
        if (type === 'ispe' && size >= hdr + 12) {
          var w = u32(data, pos + hdr + 4), h = u32(data, pos + hdr + 8);
          out.width = Math.max(out.width || 0, w);
          out.height = Math.max(out.height || 0, h);
          return false;
        }
        if (type === 'idat') { idat = { pos: pos + hdr, len: size - hdr }; return false; }
        if (type === 'infe') {
          try {
            var id = u16(data, pos + hdr + 4);
            var it = latin1(data, pos + hdr + 8, 4);
            var nm = '';
            // v2 有 item_type; 名称在类型之后, 以 \0 结尾
            var o = pos + hdr + 12;
            if (o + 4 <= pos + size) {
              var end = pos + size;
              var nameBytes = [];
              for (var q = o; q < end; q++) { if (data[q] === 0) break; nameBytes.push(data[q]); }
              nm = latin1(nameBytes, 0, nameBytes.length);
            }
            infe.push({ id: id, type: it, name: nm });
          } catch (e) {}
          return false;
        }
        if (type === 'iloc') {
          try {
            var p = pos + hdr;
            // iloc FullBox: v/f(4) 之后才是 offset_size/length_size、base/index
            var ver = data[p];
            var b0 = data[p + 4];
            var offSize = (b0 >> 4) & 0xF, lenSize = b0 & 0xF;
            var b1 = data[p + 5];
            var baseSize = (b1 >> 4) & 0xF;
            var idxSize = (ver < 2) ? 0 : (b1 & 0xF);
            var cnt = u16(data, p + 6);
            var q2 = p + 8;
            for (var i = 0; i < Math.min(cnt, 64); i++) {
              var iid = u16(data, q2); q2 += 2;
              var cm = 0;
              if (ver >= 1) { cm = u16(data, q2); q2 += 2; }
              var dr = u16(data, q2); q2 += 2;
              var base = 0;
              for (var j = 0; j < baseSize && q2 < pos + size; j++) { base = base * 256 + data[q2]; q2++; }
              var ec = u16(data, q2); q2 += 2;
              var extents = [];
              for (var k = 0; k < Math.min(ec, 16); k++) {
                var eo = 0, el = 0;
                if (idxSize) { q2 += idxSize; }
                for (var j2 = 0; j2 < offSize && q2 < pos + size; j2++) { eo = eo * 256 + data[q2]; q2++; }
                for (var j3 = 0; j3 < lenSize && q2 < pos + size; j3++) { el = el * 256 + data[q2]; q2++; }
                extents.push({ offset: eo, length: el });
              }
              iloc.push({ id: iid, construction: cm, dataRef: dr, base: base, extents: extents });
            }
          } catch (e) {}
          return false;
        }
        return true;
      });
    } catch (e) {}

    var exifItem = null;
    for (var i2 = 0; i2 < infe.length; i2++) {
      var ie = infe[i2];
      if (ie.type === 'Exif' || (ie.type === 'mime' && ie.name === 'Exif')) { exifItem = ie; break; }
    }
    if (exifItem) {
      var loc = null;
      for (var j4 = 0; j4 < iloc.length; j4++) if (iloc[j4].id === exifItem.id) { loc = iloc[j4]; break; }
      if (loc && loc.extents.length) {
        var ex = loc.extents[0];
        if (loc.construction === 1 && idat) {
          if (idat.pos + ex.offset + ex.length <= data.length) {
            parseExifItem(data.subarray(idat.pos + ex.offset, idat.pos + ex.offset + ex.length), out);
          }
        } else {
          var abs = loc.base + ex.offset;
          if (abs + ex.length <= data.length) parseExifItem(data.subarray(abs, abs + ex.length), out);
        }
      }
    }
    // 裁决
    var kinds = {};
    for (var f = 0; f < out.findings.length; f++) kinds[out.findings[f].kind] = 1;
    if (out.c2pa || kinds.ai) out.verdict = 'high';
    else if (kinds.ai_flag) out.verdict = 'medium';
    else if (out.metadata.length || kinds.app || kinds.metadata) out.verdict = 'low';
    return out;
  }
  function parseExifItem(payload, out) {
    // ExifDataBlock: 4 字节大端偏移(相对块起始)+ TIFF
    if (!payload || payload.length < 8) return;
    var off = u32(payload, 0);
    var tiff = null;
    // 常见布局: [4 字节偏移][Exif 头]TIFF, TIFF 位于 4+off(如 PIL/HEIF: off=6, TIFF 在 10)
    // 兼容: TIFF 直接在 off 处 / 直接在 4 处 / 直接在 0 处
    if (4 + off + 8 <= payload.length && (payload[4 + off] === 0x49 || payload[4 + off] === 0x4D)) {
      tiff = payload.subarray(4 + off);
    } else if (off + 8 <= payload.length && (payload[off] === 0x49 || payload[off] === 0x4D)) {
      tiff = payload.subarray(off);
    } else if (payload[4] === 0x49 || payload[4] === 0x4D) {
      tiff = payload.subarray(4);
    } else if (payload[0] === 0x49 || payload[0] === 0x4D) {
      tiff = payload;
    }
    if (!tiff) return;
    if (root.MRPEngine && typeof root.MRPEngine.parseTiff === 'function') {
      root.MRPEngine.parseTiff(tiff, out);
      if (out.metadata.length) out.metadata.unshift({ name: 'heic_exif', value: 'exif_present' });
    }
  }

  /* ---------- 懒加载 libheif 解码 ---------- */
  var libheifPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') { reject(new Error('browser only')); return; }
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('无法加载 ' + src)); };
      document.head.appendChild(s);
    });
  }
  function b64ToBytes(b64) {
    var clean = String(b64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    var out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    var table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var acc = 0, bits = 0, o = 0;
    for (var i = 0; i < clean.length; i++) {
      var v = table.indexOf(clean[i]);
      if (v < 0) continue;
      acc = (acc << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 0xFF; }
    }
    return out.subarray(0, o);
  }
  function loadWasmBinary() {
    return new Promise(function (resolve, reject) {
      var fallback = function () {
        if (root.MRP_HEIF_WASM_B64) { resolve(b64ToBytes(root.MRP_HEIF_WASM_B64)); return; }
        // 再尝试动态加载内嵌脚本(file:// 场景)
        loadScript(B64_SCRIPT_URL).then(function () {
          if (root.MRP_HEIF_WASM_B64) resolve(b64ToBytes(root.MRP_HEIF_WASM_B64));
          else reject(new Error('wasm 二进制不可用'));
        }).catch(reject);
      };
      if (typeof fetch === 'function') {
        fetch(WASM_URL).then(function (r) {
          if (!r.ok) throw new Error('wasm http ' + r.status);
          return r.arrayBuffer();
        }).then(function (buf) { resolve(new Uint8Array(buf)); }).catch(fallback);
      } else fallback();
    });
  }
  function ensure() {
    if (libheifPromise) return libheifPromise;
    libheifPromise = (function () {
      var loadLib = root.libheif
        ? Promise.resolve()
        : loadScript(SCRIPT_URL).then(function () {
            if (!root.libheif) throw new Error('libheif 加载失败');
          });
      return loadLib.then(function () {
        var L = root.libheif;
        if (L && L.HeifDecoder) return Promise.resolve(L); // bundle 直接暴露模块的情形
        if (typeof L !== 'function') throw new Error('libheif 初始化失败');
        return loadWasmBinary().then(function (wasmBinary) {
          return L({ wasmBinary: wasmBinary });
        });
      }).then(function (mod) {
        if (!mod || !mod.HeifDecoder) throw new Error('libheif 初始化失败');
        return mod;
      });
    })();
    return libheifPromise;
  }
  function decode(data) {
    var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    return ensure().then(function (mod) {
      var decoder = new mod.HeifDecoder();
      var images;
      try { images = decoder.decode(bytes); } catch (e) { throw new Error('HEIC 解码失败'); }
      if (!images || !images.length) throw new Error('HEIC 内无图像');
      var img = images[0];
      var w = img.get_width(), h = img.get_height();
      if (!w || !h || w > 32768 || h > 32768) throw new Error('尺寸异常');
      return new Promise(function (resolve, reject) {
        var imageData = new mod.ImageData(w, h);
        img.display(imageData, function (filled) {
          if (!filled || !filled.data) { reject(new Error('HEIC 渲染失败')); return; }
          resolve({ width: w, height: h, rgba: filled.data });
        });
      });
    });
  }

  var H = { scanHeic: scanHeic, decode: decode, ensure: ensure };
  root.MRPHeic = H;
  if (typeof module !== 'undefined' && module.exports) module.exports = H;
})(typeof globalThis !== 'undefined' ? globalThis : this);

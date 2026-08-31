/* ============================================================
 * Metadata Remove Pro Web - Invisible watermark (dwtDct) detect & anti
 * Copyright (c) 2026. All rights reserved.
 * ============================================================ */
(function (root) {
  'use strict';
  var SD_WM_MESSAGES = [
    { label: 'Stability (96-bit)', bytes: [0x47, 0x67, 0x51, 0x44, 0x38, 0x47, 0x34, 0x44, 0x59, 0x47, 0x59, 0x3D] },
    { label: 'diffusers SDXL (48-bit)', bits48: '101100111110110010010000011110111011000110011110' },
  ];
  var RATIO_THRESHOLD = 0.65;

  // ---- dwtDct 统计检测(RGBA 输入, 与 Python 引擎同算法) ----
  function wmStats(rgba, width, height) {
    var w = Math.floor(width / 4) * 4, h = Math.floor(height / 4) * 4;
    if (w < 64 || h < 64) return null;
    // U 通道(BT.601 全范围, 与 OpenCV BGR2YUV 一致)
    var u = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      var row = y * width * 4;
      for (var x = 0; x < w; x++) {
        var p = row + x * 4;
        var r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
        // 与 OpenCV BGR2YUV 一致的限幅整数公式(保证与 Python 引擎同结果)
        var uv = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
        u[y * w + x] = uv < 0 ? 0 : (uv > 255 ? 255 : uv);
      }
    }
    // 一级 haar DWT 的 LL 带: ll = (a+b+c+d)/2
    var wl = w >> 1, hl = h >> 1;
    var ll = new Float32Array(wl * hl);
    for (var j = 0; j < hl; j++) {
      var y0 = (j << 1) * w, y1 = ((j << 1) + 1) * w;
      for (var i = 0; i < wl; i++) {
        var x0 = i << 1;
        ll[j * wl + i] = (u[y0 + x0] + u[y0 + x0 + 1] + u[y1 + x0] + u[y1 + x0 + 1]) / 2;
      }
    }
    // 4x4 块: 最大像素(跳过 index 0)的 |v| % 36 统计
    var wmLen = 96;
    var scores = new Array(wmLen);
    for (var s = 0; s < wmLen; s++) scores[s] = 0;
    var counts = new Array(wmLen);
    for (var c2 = 0; c2 < wmLen; c2++) counts[c2] = 0;
    var near9 = 0, near27 = 0, total = 0;
    var blocksW = Math.floor(wl / 4), blocksH = Math.floor(hl / 4);
    var num = 0;
    for (var by = 0; by < blocksH; by++) {
      for (var bx = 0; bx < blocksW; bx++) {
        var maxV = 0, pos = 1;
        for (var k = 0; k < 16; k++) {
          var py = (by << 2) + (k >> 2), px = (bx << 2) + (k & 3);
          var v = ll[py * wl + px];
          if (k > 0 && Math.abs(v) > maxV) { maxV = Math.abs(v); pos = k; }
        }
        var res = maxV % 36;
        if (res > 6 && res < 12) near9++;
        else if (res > 24 && res < 30) near27++;
        total++;
        var bit = res > 18 ? 1 : 0;
        var idx = num % wmLen;
        scores[idx] += bit; counts[idx]++;
        num++;
      }
    }
    if (total < wmLen * 2) return null;
    var ratio = (near9 + near27) / total;
    var bits = new Uint8Array(wmLen);
    for (var b = 0; b < wmLen; b++) bits[b] = counts[b] > 0 && scores[b] / counts[b] > 0.5 ? 1 : 0;
    return { ratio: ratio, bits: bits };
  }
  function bitsOfBytes(bytes) {
    var out = [];
    for (var i = 0; i < bytes.length; i++) for (var b = 7; b >= 0; b--) out.push((bytes[i] >> b) & 1);
    return out;
  }
  function targetFor(msg) {
    if (msg.bytes) return bitsOfBytes(msg.bytes);
    var out = [];
    for (var i = 0; i < 48; i++) out.push(msg.bits48[i] === '1' ? 1 : 0);
    return out.concat(out);
  }
  function detectInvisible(rgba, width, height) {
    if (width * height < 256 * 256) return { status: 'too_small', ratio: 0, hit: '' };
    var st = wmStats(rgba, width, height);
    if (!st) return { status: 'unsupported', ratio: 0, hit: '' };
    var hit = '';
    for (var m = 0; m < SD_WM_MESSAGES.length; m++) {
      var t = targetFor(SD_WM_MESSAGES[m]);
      if (t.length !== 96) continue;
      var err = 0;
      for (var i = 0; i < 96; i++) if (st.bits[i] !== t[i]) err++;
      if (err <= 8) { hit = SD_WM_MESSAGES[m].label; break; }
    }
    if (st.ratio >= RATIO_THRESHOLD || hit) {
      return { status: 'detected', ratio: Math.round(st.ratio * 1000) / 1000, hit: hit };
    }
    return { status: 'clean', ratio: Math.round(st.ratio * 1000) / 1000, hit: '' };
  }

  // ---- 对抗变换(canvas, 仅浏览器) ----
  function canvasFromImage(img) {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return c;
  }
  function chromaLowPass(src) {
    // 色度 1/2 下采样再还原: 画到半尺寸再画回(等效 U/V 低通, 破坏 dwtDct)
    var w = src.width, h = src.height;
    var half = document.createElement('canvas');
    half.width = Math.max(2, w >> 1); half.height = Math.max(2, h >> 1);
    var hctx = half.getContext('2d');
    hctx.imageSmoothingEnabled = true; hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(src, 0, 0, half.width, half.height);
    var out = document.createElement('canvas');
    out.width = w; out.height = h;
    var octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
    octx.drawImage(half, 0, 0, w, h);
    return out;
  }
  function resampleRotate(src, scale, angle) {
    var w = src.width, h = src.height;
    var nw = Math.max(2, Math.round(w * (1 + scale))), nh = Math.max(2, Math.round(h * (1 + scale)));
    var big = document.createElement('canvas');
    big.width = nw; big.height = nh;
    var bctx = big.getContext('2d');
    bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(src, 0, 0, nw, nh);
    var out = document.createElement('canvas');
    out.width = w; out.height = h;
    var octx = out.getContext('2d');
    octx.translate(w / 2, h / 2);
    octx.rotate(angle * Math.PI / 180);
    octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
    octx.drawImage(big, -nw / 2 + (nw - w) / 2, -nh / 2 + (nh - h) / 2, nw, nh);
    return out;
  }
  function applyAntiWm(canvas, level, rng) {
    var out = chromaLowPass(canvas);
    if (level === 'medium' || level === 'strong') {
      var scale = level === 'medium' ? 0.005 + rng() * 0.015 : 0.01 + rng() * 0.02;
      var ang = level === 'medium' ? -0.5 + rng() * 1.0 : -1.0 + rng() * 2.0;
      out = resampleRotate(out, scale, ang);
    }
    if (level === 'strong') {
      // 高斯噪声近似: 像素级随机抖动
      var ctx = out.getContext('2d');
      var img = ctx.getImageData(0, 0, out.width, out.height);
      var d = img.data, sigma = 1.0 + rng() * 1.0, alpha = 0.04 + rng() * 0.04;
      for (var i = 0; i < d.length; i += 4) {
        var n = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * sigma * 0.8;
        d[i] = Math.max(0, Math.min(255, d[i] * (1 - alpha) + n * 255 + d[i] * alpha * 0.5));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * (1 - alpha) + n * 255 + d[i + 1] * alpha * 0.5));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * (1 - alpha) + n * 255 + d[i + 2] * alpha * 0.5));
      }
      ctx.putImageData(img, 0, 0);
    }
    return out;
  }

  var AntiWM = { wmStats: wmStats, detectInvisible: detectInvisible,
    applyAntiWm: applyAntiWm, chromaLowPass: chromaLowPass, canvasFromImage: canvasFromImage };
  root.MRPAntiWM = AntiWM;
  if (typeof module !== 'undefined' && module.exports) module.exports = AntiWM;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ============================================================
 * Metadata Remove Pro Web - Visible watermark grid detect & patch
 * Copyright (c) 2026. All rights reserved.
 * ============================================================ */
(function (root) {
  'use strict';
  function sat(r, g, b) { return Math.max(r, g, b) - Math.min(r, g, b) > 50 && Math.max(r, g, b) > 90; }
  function detectVisibleGrid(img) {
    var w = img.width, h = img.height;
    if (w < 200 || h < 200) return [];
    var x0 = Math.floor(w * 0.85), y0 = Math.floor(h * 0.80);
    var rw = w - x0, rh = h - y0;
    var d = img.data;
    var seen = new Uint8Array(rw * rh);
    var comps = [];
    for (var y = 0; y < rh; y++) {
      for (var x = 0; x < rw; x++) {
        if (seen[y * rw + x]) continue;
        var p = ((y + y0) * w + x + x0) * 4;
        if (!sat(d[p], d[p + 1], d[p + 2])) continue;
        var stack = [[x, y]], pts = [];
        seen[y * rw + x] = 1;
        while (stack.length) {
          var q = stack.pop();
          pts.push(q);
          var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (var i = 0; i < 4; i++) {
            var nx = q[0] + dirs[i][0], ny = q[1] + dirs[i][1];
            if (nx < 0 || ny < 0 || nx >= rw || ny >= rh || seen[ny * rw + nx]) continue;
            var pp = ((ny + y0) * w + nx + x0) * 4;
            if (sat(d[pp], d[pp + 1], d[pp + 2])) { seen[ny * rw + nx] = 1; stack.push([nx, ny]); }
          }
        }
        var minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
        for (var k = 0; k < pts.length; k++) {
          minX = Math.min(minX, pts[k][0]); maxX = Math.max(maxX, pts[k][0]);
          minY = Math.min(minY, pts[k][1]); maxY = Math.max(maxY, pts[k][1]);
        }
        var bw = maxX - minX + 1, bh = maxY - minY + 1;
        if (bw >= 6 && bw <= 60 && bh >= 6 && bh <= 60 && bw / bh >= 0.5 && bw / bh <= 2.0) {
          comps.push([minX + x0, minY + y0, bw, bh]);
        }
      }
    }
    var groups = {};
    for (var c = 0; c < comps.length; c++) {
      var key = Math.round((comps[c][0] + comps[c][2] / 2) / 40);
      (groups[key] = groups[key] || []).push(comps[c]);
    }
    for (var gk in groups) {
      var g = groups[gk];
      g.sort(function (a, b) { return a[1] - b[1]; });
      for (var s = 0; s < g.length - 3; s++) {
        for (var e = Math.min(g.length, s + 9); e >= s + 4; e--) {
          var win = g.slice(s, e);
          var cxs = win.map(function (c) { return c[0] + c[2] / 2; });
          if (Math.max.apply(null, cxs) - Math.min.apply(null, cxs) > 25) continue;
          var hs = win.map(function (c) { return c[3]; });
          if (Math.max.apply(null, hs) - Math.min.apply(null, hs) > 10) continue;
          var gaps = [];
          for (var gi = 0; gi < win.length - 1; gi++) gaps.push(win[gi + 1][1] - win[gi][1] - win[gi][3]);
          var gapsOk = true;
          for (var gj = 0; gj < gaps.length; gj++) if (gaps[gj] < -4 || gaps[gj] > 40) { gapsOk = false; break; }
          if (gapsOk && Math.max.apply(null, gaps) - Math.min.apply(null, gaps) <= 14) {
            var rightEdge = Math.max.apply(null, win.map(function (c) { return c[0] + c[2]; }));
            var bottomEdge = Math.max.apply(null, win.map(function (c) { return c[1] + c[3]; }));
            if (w - rightEdge <= 70 && h - bottomEdge <= 70) return win;
          }
        }
      }
    }
    return [];
  }
  function patchVisibleBox(img, box) {
    var w = img.width, h = img.height;
    var pad = 3;
    var x0 = Math.max(0, box[0] - pad), y0 = Math.max(0, box[1] - pad);
    var x1 = Math.min(w, box[0] + box[2] + pad), y1 = Math.min(h, box[1] + box[3] + pad);
    var d = img.data;
    var sr = 0, sg = 0, sb = 0, n = 0;
    for (var xx = x0; xx < x1; xx++) {
      if (y0 - 1 >= 0) { var p1 = ((y0 - 1) * w + xx) * 4; sr += d[p1]; sg += d[p1 + 1]; sb += d[p1 + 2]; n++; }
      if (y1 < h) { var p2 = (y1 * w + xx) * 4; sr += d[p2]; sg += d[p2 + 1]; sb += d[p2 + 2]; n++; }
    }
    for (var yy = y0; yy < y1; yy++) {
      if (x0 - 1 >= 0) { var p3 = (yy * w + x0 - 1) * 4; sr += d[p3]; sg += d[p3 + 1]; sb += d[p3 + 2]; n++; }
      if (x1 < w) { var p4 = (yy * w + x1) * 4; sr += d[p4]; sg += d[p4 + 1]; sb += d[p4 + 2]; n++; }
    }
    if (!n) return;
    var fr = Math.round(sr / n), fg = Math.round(sg / n), fb = Math.round(sb / n);
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var p = (y * w + x) * 4;
        d[p] = fr; d[p + 1] = fg; d[p + 2] = fb;
      }
    }
  }
  var Visible = { detectVisibleGrid: detectVisibleGrid, patchVisibleBox: patchVisibleBox };
  root.MRPVisible = Visible;
  if (typeof module !== 'undefined' && module.exports) module.exports = Visible;
})(typeof globalThis !== 'undefined' ? globalThis : this);

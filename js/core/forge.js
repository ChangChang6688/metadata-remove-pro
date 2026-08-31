/* ============================================================
 * Metadata Remove Pro Web - Forge human traces (camera EXIF / XMP / GPS / ICC)
 * Copyright (c) 2026. All rights reserved.
 * ============================================================ */
(function (root) {
  'use strict';
  var DB = root.MRPCameras;
  var SRGB_B64 = root.MRPSrgb;
  var CAMERAS = DB.cameras;
  var REGIONS = DB.regions;
  var REGION_KEYS = Object.keys(REGIONS);
  var SCENES = [
    ['day', 13.0, 15.0, 0.12],
    ['overcast', 9.5, 11.5, 0.25],
    ['indoor', 5.5, 7.5, 0.45],
    ['night', 1.0, 3.5, 0.75],
  ];
  var ISO_LADDER = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 51200, 102400];
  var APERTURE_LADDER = [1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8, 3.2, 3.5, 4.0, 4.5, 5.0, 5.6, 6.3, 7.1, 8.0, 9.0, 10.0, 11.0, 13.0, 16.0];
  var SHUTTER_STOPS = [8000, 6400, 5000, 4000, 3200, 2500, 2000, 1600, 1250, 1000, 800, 640, 500, 400, 320, 250, 200, 160, 125, 100, 80, 60, 50, 40, 30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3, 2, 1];

  // ---- 工具 ----
  function sha256(bytes) {
    // 纯 JS SHA-256(兼容 file:// 环境无 crypto.subtle)
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var len = bytes.length;
    var msg = new Uint8Array(((len + 8) >> 6 << 6) + 64);
    msg.set(bytes);
    msg[len] = 0x80;
    var dv = new DataView(msg.buffer);
    dv.setUint32(msg.length - 8, (len >>> 29) & 0xFFFFFFFF, false);
    dv.setUint32(msg.length - 4, (len << 3) >>> 0, false);
    var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var w = new Int32Array(64);
    for (var off = 0; off < msg.length; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false) | 0;
      for (var j = 16; j < 64; j++) {
        var s0 = ((w[j-15] >>> 7) | (w[j-15] << 25)) ^ ((w[j-15] >>> 18) | (w[j-15] << 14)) ^ (w[j-15] >>> 3);
        var s1 = ((w[j-2] >>> 17) | (w[j-2] << 15)) ^ ((w[j-2] >>> 19) | (w[j-2] << 13)) ^ (w[j-2] >>> 10);
        w[j] = (w[j-16] + s0 + w[j-7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var k = 0; k < 64; k++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[k] + w[k]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = new Uint8Array(32);
    var ov = new DataView(out.buffer);
    for (var x = 0; x < 8; x++) ov.setUint32(x * 4, h[x] >>> 0, false);
    return out;
  }
  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFromBytes(bytes) {
    var dv = new DataView(bytes.buffer || bytes, 0, 4);
    return dv.getUint32(0, false);
  }
  function randomSeedBytes() {
    var b = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }
  function gauss(rng, mu, sigma) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
  function clampIso(ladder, isoLo, isoHi) {
    var out = ladder.filter(function (x) { return x >= isoLo && x <= isoHi; });
    if (!out.length) out = [ladder.reduce(function (a, b) { return Math.abs(b - isoLo) < Math.abs(a - isoLo) ? b : a; })];
    return out;
  }
  function uuidHex(rng) {
    function h(n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(rng() * 16).toString(16); return s; }
    return h(8) + '-' + h(4) + '-4' + h(3) + '-8' + h(3) + '-' + h(12);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function parseWindow(spec, anchor) {
    var now = anchor || new Date();
    var start = new Date(now.getTime() - 730 * 86400 * 1000);
    var end = now;
    if (spec) {
      var parts = spec.split('..');
      if (parts.length === 2) {
        start = new Date(parts[0] + 'T00:00:00');
        if (parts[1].toLowerCase() !== 'now') end = new Date(parts[1] + 'T00:00:00');
      }
    }
    return [start, end];
  }
  function exifDate(dt) {
    return dt.getFullYear() + ':' + pad2(dt.getMonth() + 1) + ':' + pad2(dt.getDate()) + ' ' +
      pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds());
  }
  function isoDate(dt, tz) {
    return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()) + 'T' +
      pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds()) + tz;
  }
  function dms(deg) {
    var d = Math.floor(Math.abs(deg));
    var mf = (Math.abs(deg) - d) * 60;
    var m = Math.floor(mf);
    var s = Math.round((mf - m) * 60 * 100) / 100;
    return [d, m, s];
  }
  function rat(v, den) { return [Math.round(v * den), den]; }
  function ascii(s) {
    var b = new Uint8Array(s.length + 1);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xFF;
    return b;
  }

  // ---- TIFF/EXIF 生成 ----
  var T_BYTE = 1, T_ASCII = 2, T_SHORT = 3, T_LONG = 4, T_RATIONAL = 5, T_SRATIONAL = 10;
  function E(tag, type, value) {
    var count = 1;
    if (type === T_ASCII) count = value.length + 1;
    else if (type === T_BYTE) count = value instanceof Uint8Array ? value.length : 1;
    else if (type === T_RATIONAL || type === T_SRATIONAL) count = Array.isArray(value[0]) ? value.length : 1;
    return { tag: tag, type: type, count: count, value: value };
  }
  function valueSize(val) {
    if (typeof val === 'string') { var l = val.length + 1; return l <= 4 ? 0 : l + (l & 1); }
    if (val instanceof Uint8Array) return val.length <= 4 ? 0 : val.length + (val.length & 1);
    if (Array.isArray(val) && Array.isArray(val[0])) return val.length * 8;
    if (Array.isArray(val)) return 8;
    return 0;
  }
  function buildTiff(entries, gpsEntries) {
    var list = entries.slice().sort(function (a, b) { return a.tag - b.tag; });
    var gpsList = (gpsEntries || []).slice().sort(function (a, b) { return a.tag - b.tag; });
    var n = list.length, m = gpsList.length;
    var ifd0 = 8;
    var ifd0Count = n + (m ? 1 : 0); // 含追加的 GPS 指针条目
    var ifd0Size = 2 + ifd0Count * 12 + 4;
    var gpsIfdSize = m ? (2 + m * 12 + 4) : 0;
    var gpsOff = m ? ifd0 + ifd0Size : 0;
    var dataAt = ifd0 + ifd0Size + gpsIfdSize;
    var total = dataAt;
    list.forEach(function (en) { total += valueSize(en.value); });
    gpsList.forEach(function (en) { total += valueSize(en.value); });
    var out = new Uint8Array(total);
    var ov = new DataView(out.buffer);
    out[0] = 0x49; out[1] = 0x49; out[2] = 0x2A; out[3] = 0;
    ov.setUint32(4, ifd0, true);
    function place(val) {
      if (typeof val === 'string') {
        var b = ascii(val);
        if (b.length <= 4) { var p = new Uint8Array(4); p.set(b); return { inline: p }; }
        var off = dataAt; dataAt += b.length + (b.length & 1);
        return { off: off, bytes: b };
      }
      if (val instanceof Uint8Array) {
        if (val.length <= 4) { var p2 = new Uint8Array(4); p2.set(val); return { inline: p2 }; }
        var off2 = dataAt; dataAt += val.length + (val.length & 1);
        return { off: off2, bytes: val };
      }
      if (Array.isArray(val) && Array.isArray(val[0])) {
        var b3 = new Uint8Array(val.length * 8);
        var dv3 = new DataView(b3.buffer);
        for (var i3 = 0; i3 < val.length; i3++) { dv3.setUint32(i3 * 8, val[i3][0], true); dv3.setUint32(i3 * 8 + 4, val[i3][1], true); }
        var off3 = dataAt; dataAt += b3.length;
        return { off: off3, bytes: b3 };
      }
      if (Array.isArray(val)) {
        var b4 = new Uint8Array(8);
        var dv4 = new DataView(b4.buffer);
        dv4.setUint32(0, val[0], true); dv4.setUint32(4, val[1], true);
        var off4 = dataAt; dataAt += 8;
        return { off: off4, bytes: b4 };
      }
      var r = new Uint8Array(4);
      new DataView(r.buffer).setUint32(0, val >>> 0, true);
      return { inline: r };
    }
    function writeIFD(pos, arr, next) {
      ov.setUint16(pos, arr.length, true);
      for (var e = 0; e < arr.length; e++) {
        var en = arr[e];
        var ep = pos + 2 + e * 12;
        ov.setUint16(ep, en.tag, true);
        ov.setUint16(ep + 2, en.type, true);
        ov.setUint32(ep + 4, en.count, true);
        var placed = place(en.value);
        if (placed.inline) out.set(placed.inline, ep + 8);
        else { ov.setUint32(ep + 8, placed.off, true); out.set(placed.bytes, placed.off); }
      }
      ov.setUint32(pos + 2 + arr.length * 12, next, true);
    }
    var withGps = m ? list.concat([{ tag: 0x8825, type: T_LONG, count: 1, value: gpsOff }])
      .sort(function (a, b) { return a.tag - b.tag; }) : list;
    writeIFD(ifd0, withGps, gpsOff);
    if (m) writeIFD(gpsOff, gpsList, 0);
    return out;
  }
  function xmpDesktop(rng, ver, softVer, dtIso, rawName, city, dt, tz) {
    var did = 'xmp.did:' + uuidHex(rng).toUpperCase();
    var iid = 'xmp.iid:' + uuidHex(rng).toUpperCase();
    var iid2 = 'xmp.iid:' + uuidHex(rng).toUpperCase();
    var loc = '';
    if (city) loc = '<Iptc4xmpCore:CountryCode>' + city.cc + '</Iptc4xmpCore:CountryCode>' +
      '<Iptc4xmpCore:Location>' + city.name + '</Iptc4xmpCore:Location>' +
      '<Iptc4xmpCore:Region>' + city.state + '</Iptc4xmpCore:Region>';
    var created = dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()) + 'T' +
      pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds());
    return '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" ' +
      'xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" ' +
      'xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
      'xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">' +
      '<xmp:CreatorTool>' + softVer + '</xmp:CreatorTool>' +
      '<xmp:CreateDate>' + dtIso + '</xmp:CreateDate>' +
      '<xmp:ModifyDate>' + dtIso + '</xmp:ModifyDate>' +
      '<xmp:MetadataDate>' + dtIso + '</xmp:MetadataDate>' +
      '<xmpMM:DocumentID>' + did + '</xmpMM:DocumentID>' +
      '<xmpMM:InstanceID>' + iid + '</xmpMM:InstanceID>' +
      '<xmpMM:OriginalDocumentID>' + did + '</xmpMM:OriginalDocumentID>' +
      '<xmpMM:PreservedFileName>' + rawName + '</xmpMM:PreservedFileName>' +
      '<xmpMM:History><rdf:Seq>' +
      '<rdf:li stEvt:action="derived" stEvt:parameters="converted to image/jpeg" stEvt:softwareAgent="' + softVer + '" stEvt:when="' + dtIso + '"/>' +
      '<rdf:li stEvt:action="saved" stEvt:instanceID="' + iid2 + '" stEvt:softwareAgent="' + softVer + '" stEvt:when="' + dtIso + '" stEvt:changed="/metadata"/>' +
      '</rdf:Seq></xmpMM:History>' +
      '<crs:Version>' + ver + '</crs:Version>' +
      '<crs:RawFileName>' + rawName + '</crs:RawFileName>' +
      '<photoshop:DateCreated>' + created + '</photoshop:DateCreated>' +
      '<dc:format>image/jpeg</dc:format>' + loc +
      '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  }
  function xmpPhone(rng, tool, dtIso, city) {
    var loc = '';
    if (city) loc = '<Iptc4xmpCore:CountryCode>' + city.cc + '</Iptc4xmpCore:CountryCode>' +
      '<Iptc4xmpCore:Location>' + city.name + '</Iptc4xmpCore:Location>' +
      '<Iptc4xmpCore:Region>' + city.state + '</Iptc4xmpCore:Region>';
    return '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" ' +
      'xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#" xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">' +
      '<xmp:CreatorTool>' + tool + '</xmp:CreatorTool>' +
      '<xmp:CreateDate>' + dtIso + '</xmp:CreateDate>' +
      '<xmp:ModifyDate>' + dtIso + '</xmp:ModifyDate>' +
      '<xmpMM:InstanceID>xmp.iid:' + uuidHex(rng).toUpperCase() + '</xmpMM:InstanceID>' +
      '<xmpMM:History><rdf:Seq><rdf:li stEvt:action="saved" stEvt:softwareAgent="' + tool + '" stEvt:when="' + dtIso + '" stEvt:changed="/metadata"/></rdf:Seq></xmpMM:History>' + loc +
      '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  }

  // ---- 会话与生成 ----
  function ForgeSession(opts) {
    opts = opts || {};
    this.seed = opts.seedBytes || randomSeedBytes();
    this.region = REGIONS[opts.region] ? opts.region : 'us';
    this.gpsMode = opts.gps || 'off';
    this.batch = !!opts.batch;
    var anchor = opts.seedBytes ? new Date(2025, 5, 1, 12, 0, 0) : null;
    var win = parseWindow(opts.timeWindow || '', anchor);
    this.start = win[0]; this.end = win[1];
    this.sessionRng = mulberry32(seedFromBytes(this.seed));
    this.profile = this.batch ? this.pickProfile(this.sessionRng) : null;
  }
  ForgeSession.prototype.pickProfile = function (rng) {
    var pool = CAMERAS.filter(function (c) {
      return (c.regions || REGION_KEYS).indexOf(this.region) >= 0;
    }.bind(this));
    var camera = pick(rng, pool.length ? pool : CAMERAS);
    var scene = pick(rng, SCENES);
    var region = REGIONS[this.region];
    var city = this.gpsMode === 'random' ? pick(rng, region.cities) : null;
    var tz = city ? city.tz : pick(rng, region.tz_pool);
    var baseDt = new Date(this.start.getTime() + rng() * Math.max(1, this.end.getTime() - this.start.getTime()));
    var edit = this.pickEdit(rng, camera);
    return { camera: camera, scene: scene, city: city, tz: tz, baseDt: baseDt, edit: edit };
  };
  ForgeSession.prototype.pickEdit = function (rng, camera) {
    if (camera.phone) {
      if (rng() < 0.5) return ['sooc', null];
      return ['phone', pick(rng, camera.phone_editors || ['Snapseed'])];
    }
    if (rng() < 0.75) return ['desktop', [camera.software || 'Adobe Photoshop Lightroom Classic', pick(rng, camera.editor_versions || ['13.5'])]];
    return ['sooc', null];
  };
  ForgeSession.prototype.forFile = function (fileBytes, ext) {
    var h = sha256(concatBytes([this.seed, fileBytes.slice(0, 65536)]));
    var rng = mulberry32(seedFromBytes(h));
    var prof = this.batch ? this.profile : this.pickProfile(rng);
    var camera = prof.camera, scene = prof.scene, city = prof.city, tz = prof.tz, baseDt = prof.baseDt, edit = prof.edit;
    var lens = pick(rng, camera.lenses);
    var isoLadder = clampIso(ISO_LADDER, camera.iso[0], camera.iso[1]);
    var iso = isoLadder[Math.min(isoLadder.length - 1, Math.max(0, Math.floor(Math.abs(gauss(rng, scene[3] * isoLadder.length, isoLadder.length * 0.25))) % isoLadder.length))];
    var ev = scene[1] + rng() * (scene[2] - scene[1]);
    var apChoices = APERTURE_LADDER.filter(function (a) { return a >= lens.aperture - 0.01 && a <= 16; });
    var aperture = apChoices.length ? pick(rng, apChoices) : lens.aperture;
    var t = aperture * aperture * 100.0 / (iso * Math.pow(2, ev));
    var exp;
    if (t >= 1.0) {
      var sh = SHUTTER_STOPS.reduce(function (a, b) { return Math.abs(b - t) < Math.abs(a - t) ? b : a; });
      exp = [sh, 1];
    } else {
      var inv = SHUTTER_STOPS.reduce(function (a, b) { return Math.abs(b - 1.0 / t) < Math.abs(a - 1.0 / t) ? b : a; });
      exp = [1, inv];
    }
    var focal = Math.round(rng() * (lens.fmax - lens.fmin) * 10 + lens.fmin * 10) / 10;
    var focal35 = camera.eq_focal || Math.round(focal * (camera.crop || 1));
    function serial() {
      var spec = camera.serial;
      if (!spec) return '';
      if (spec.hex) {
        var s = '';
        for (var i = 0; i < spec.len; i++) s += Math.floor(rng() * 16).toString(16).toUpperCase();
        return s;
      }
      var d2 = '';
      for (var j = 0; j < spec.len; j++) d2 += Math.floor(rng() * 10);
      return d2;
    }
    var bodySerial = serial();
    var lensSerial = camera.phone ? '' : serial();
    var uid = '';
    for (var u = 0; u < 32; u++) uid += Math.floor(rng() * 16).toString(16).toUpperCase();
    var dt = new Date(baseDt.getTime() + rng() * 10800 * 1000);
    var ds = exifDate(dt);
    var sub = String(Math.floor(10 + rng() * 989));
    var dtIso = isoDate(dt, tz);
    var stem = pick(rng, ['IMG_', 'DSC_', '_MG']) + String(1000 + Math.floor(rng() * 9000));
    var rawName = stem + '.' + (camera.raw || 'DNG');
    // EXIF entries
    var entries = [
      E(0x010F, T_ASCII, camera.make),
      E(0x0110, T_ASCII, camera.model),
      E(0x0112, T_SHORT, 1),
      E(0x0132, T_ASCII, ds),
      E(0x9003, T_ASCII, ds),
      E(0x9004, T_ASCII, ds),
      E(0x9291, T_ASCII, sub),
      E(0x9292, T_ASCII, sub),
      E(0x9011, T_ASCII, tz),
      E(0x829A, T_RATIONAL, [exp[0], exp[1]]),
      E(0x829D, T_RATIONAL, rat(aperture, 100)),
      E(0x8827, T_SHORT, iso),
      E(0x920A, T_RATIONAL, rat(focal, 10)),
      E(0xA405, T_SHORT, focal35),
      E(0x9209, T_SHORT, 16),
      E(0x9204, T_SRATIONAL, [0, 1]),
      E(0xA001, T_SHORT, 1),
      E(0xA402, T_SHORT, 0),
      E(0xA403, T_SHORT, 0),
      E(0xA406, T_SHORT, 0),
      E(0x9207, T_SHORT, 5),
      E(0xA420, T_ASCII, uid),
    ];
    if (bodySerial) entries.push(E(0xA431, T_ASCII, bodySerial));
    if (lensSerial) {
      entries.push(E(0xA433, T_ASCII, lens.make));
      entries.push(E(0xA434, T_ASCII, lens.model));
      entries.push(E(0xA435, T_ASCII, lensSerial));
    }
    var gpsEntries = null;
    if (city && this.gpsMode === 'random') {
      var lat = city.lat + (rng() - 0.5) * 0.016;
      var lng = city.lng + (rng() - 0.5) * 0.016;
      var alt = 10 + rng() * 290;
      var la = dms(lat), lo = dms(lng);
      gpsEntries = [
        E(0, T_BYTE, new Uint8Array([2, 3, 0, 0])),
        E(1, T_ASCII, lat >= 0 ? 'N' : 'S'),
        E(2, T_RATIONAL, [rat(la[0], 1), rat(la[1], 1), rat(la[2], 100)]),
        E(3, T_ASCII, lng >= 0 ? 'E' : 'W'),
        E(4, T_RATIONAL, [rat(lo[0], 1), rat(lo[1], 1), rat(lo[2], 100)]),
        E(5, T_BYTE, new Uint8Array([0])),
        E(6, T_RATIONAL, rat(alt, 10)),
        E(29, T_ASCII, dt.getFullYear() + ':' + pad2(dt.getMonth() + 1) + ':' + pad2(dt.getDate())),
      ];
    }
    var xmp = '';
    var style = edit[0], tool = edit[1];
    if (style === 'desktop' && tool) {
      var softVer = tool[0] + ' ' + tool[1] + ' (Windows)';
      entries.push(E(0x0131, T_ASCII, softVer));
      xmp = xmpDesktop(rng, tool[1], softVer, dtIso, rawName, city, dt, tz);
    } else if (style === 'phone' && tool) {
      xmp = xmpPhone(rng, tool, dtIso, city);
    }
    var exifTiff = buildTiff(entries, gpsEntries);
    var shutterS = exp[0] === 1 ? '1/' + exp[1] : String(exp[0]);
    var summary = camera.model + ' · ' + lens.model + ' · ' + shutterS + 's f/' + aperture + ' ISO ' + iso + ' · ' + (city ? city.name : 'NoGPS');
    return {
      exifTiff: exifTiff, xmpPacket: xmp, iso: iso,
      icc: SRGB_B64 ? b64decode(SRGB_B64) : null,
      summary: summary,
    };
  };
  function b64decode(b64) {
    var bin = atob ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function concatBytes(parts) {
    var total = 0;
    for (var i = 0; i < parts.length; i++) total += parts[i].length;
    var out = new Uint8Array(total), off = 0;
    for (var j = 0; j < parts.length; j++) { out.set(parts[j], off); off += parts[j].length; }
    return out;
  }

  // ---- 字节级注入(像素无损) ----
  function injectJpegMeta(data, exifTiff, xmpPacket, icc) {
    if (data.length < 2 || data[0] !== 0xFF || data[1] !== 0xD8) return null;
    var parts = [data.subarray(0, 2)];
    if (exifTiff && exifTiff.length) {
      var p1 = concatBytes([ascii('Exif\0\0').subarray(0, 6), exifTiff]);
      parts.push(mkSeg(0xE1, p1));
    }
    if (xmpPacket) {
      var p2 = concatBytes([ascii('http://ns.adobe.com/xap/1.0/').subarray(0, 29), new TextEncoder().encode(xmpPacket)]);
      parts.push(mkSeg(0xE1, p2));
    }
    if (icc && icc.length) {
      var p3 = concatBytes([ascii('ICC_PROFILE\0').subarray(0, 12), new Uint8Array([1, 1]), icc]);
      parts.push(mkSeg(0xE2, p3));
    }
    parts.push(data.subarray(2));
    return concatBytes(parts);
  }
  function mkSeg(marker, payload) {
    var seg = new Uint8Array(4 + payload.length);
    seg[0] = 0xFF; seg[1] = marker;
    seg[2] = ((payload.length + 2) >> 8) & 0xFF; seg[3] = (payload.length + 2) & 0xFF;
    seg.set(payload, 4);
    return seg;
  }
  async function injectPngMeta(data, exifTiff, xmpPacket, icc) {
    var E2 = root.MRPEngine;
    var chunks = E2.pngChunks(data);
    if (!chunks) return null;
    var parts = [data.subarray(0, 8)];
    var done = {};
    function emit(type, payload) {
      var raw = concatBytes([ascii(type).subarray(0, 4), payload]);
      var lenB = new Uint8Array(4);
      new DataView(lenB.buffer).setUint32(0, payload.length, false);
      var crcB = new Uint8Array(4);
      new DataView(crcB.buffer).setUint32(0, E2.crc32(raw), false);
      parts.push(lenB, raw, crcB);
    }
    for (var i = 0; i < chunks.length; i++) {
      var ch = chunks[i];
      if (ch.type === 'IHDR') {
        emit('IHDR', ch.data);
        if (icc && icc.length && !done.iCCP) {
          var compressed = await zlibDeflate(icc);
          if (compressed) { emit('iCCP', concatBytes([ascii('ICC profile\0').subarray(0, 12), new Uint8Array([0]), compressed])); done.iCCP = 1; }
        }
        if (exifTiff && exifTiff.length && !done.eXIf) { emit('eXIf', exifTiff); done.eXIf = 1; }
        if (xmpPacket && !done.iTXt) {
          emit('iTXt', concatBytes([ascii('XML:com.adobe.xmp').subarray(0, 17), new Uint8Array(5), new TextEncoder().encode(xmpPacket)]));
          done.iTXt = 1;
        }
        continue;
      }
      emit(ch.type, ch.data);
    }
    return concatBytes(parts);
  }
  async function zlibDeflate(bytes) {
    try {
      if (typeof CompressionStream !== 'undefined') {
        var cs = new CompressionStream('deflate');
        var writer = cs.writable.getWriter();
        writer.write(bytes); writer.close();
        var buf = await new Response(cs.readable).arrayBuffer();
        return new Uint8Array(buf);
      }
    } catch (e) {}
    return null;
  }
  function injectWebpMeta(data, exifTiff, xmpPacket, icc) {
    var E2 = root.MRPEngine;
    var chunks = E2.webpChunks(data);
    if (!chunks) return null;
    var add = [];
    if (exifTiff && exifTiff.length) add.push(['EXIF', exifTiff]);
    if (xmpPacket) add.push(['XMP ', new TextEncoder().encode(xmpPacket)]);
    if (icc && icc.length) add.push(['ICCP', icc]);
    if (!add.length) return data;
    var flags = 0;
    var map = { ICCP: 0x20, EXIF: 0x08, 'XMP ': 0x04 };
    add.forEach(function (a) { flags |= map[a[0]] || 0; });
    var hasVp8x = chunks.some(function (c) { return c.four === 'VP8X'; });
    var w = 0, h = 0;
    if (!hasVp8x) {
      for (var i = 0; i < chunks.length; i++) {
        var c = chunks[i];
        if (c.four === 'VP8 ' && c.data.length >= 10 && c.data[3] === 0x9D && c.data[4] === 0x01 && c.data[5] === 0x2A) {
          w = (c.data[6] | (c.data[7] << 8)) & 0x3FFF; h = (c.data[8] | (c.data[9] << 8)) & 0x3FFF;
        } else if (c.four === 'VP8L' && c.data.length >= 5 && c.data[0] === 0x2F) {
          w = (c.data[1] | ((c.data[2] & 0x3F) << 8)) + 1;
          h = (((c.data[2] >> 6) | (c.data[3] << 2) | ((c.data[4] & 0xF) << 10))) + 1;
        } else if (c.four === 'ALPH' && c.data.length >= 5) {
          w = (c.data[1] | (c.data[2] << 8)) + 1; h = (c.data[3] | (c.data[4] << 8)) + 1;
        }
      }
      if (!(w && h)) return data;
    }
    var parts = [data.subarray(0, 12)];
    function emit(four, payload) {
      var head = new Uint8Array(8);
      head[0] = four.charCodeAt(0); head[1] = four.charCodeAt(1); head[2] = four.charCodeAt(2); head[3] = four.charCodeAt(3);
      new DataView(head.buffer).setUint32(4, payload.length, true);
      parts.push(head, payload);
      if (payload.length & 1) parts.push(new Uint8Array(1));
    }
    if (!hasVp8x) {
      var vp = new Uint8Array(8);
      vp[0] = flags;
      var dv = new DataView(vp.buffer);
      dv.setUint32(4, ((w - 1) & 0xFFFFFF) | (((h - 1) & 0xFFFFFF) << 24), true);
      emit('VP8X', vp);
      add.forEach(function (a) { emit(a[0], a[1]); });
    }
    for (var j = 0; j < chunks.length; j++) {
      var ch = chunks[j];
      if (ch.four === 'VP8X') {
        var np = new Uint8Array(ch.data.length);
        np.set(ch.data);
        if (np.length) np[0] = (np[0] | flags) & 0xFF;
        emit('VP8X', np);
        add.forEach(function (a) { emit(a[0], a[1]); });
        continue;
      }
      emit(ch.four, ch.data);
    }
    var out = concatBytes(parts);
    new DataView(out.buffer, out.byteOffset).setUint32(4, out.length - 8, true);
    return out;
  }

  // ---- 像素级相机感(canvas) ----
  function applyPixel(canvas, iso) {
    var ctx = canvas.getContext('2d');
    var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var d = id.data;
    var sigma = 0.8 + Math.sqrt(iso / 100.0) * 0.35;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * sigma;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(id, 0, 0);
    // 轻微暗角
    var w = canvas.width, h = canvas.height;
    var cx = w / 2, cy = h / 2, maxR = Math.sqrt(cx * cx + cy * cy);
    var id2 = ctx.getImageData(0, 0, w, h);
    var d2 = id2.data, s = 0.03;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var r = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxR;
        var f = 1 - s * r * r;
        var p = (y * w + x) * 4;
        d2[p] = Math.round(d2[p] * f); d2[p + 1] = Math.round(d2[p + 1] * f); d2[p + 2] = Math.round(d2[p + 2] * f);
      }
    }
    ctx.putImageData(id2, 0, 0);
    return canvas;
  }

  var Forge = {
    ForgeSession: ForgeSession, sha256: sha256,
    injectJpegMeta: injectJpegMeta, injectPngMeta: injectPngMeta, injectWebpMeta: injectWebpMeta,
    applyPixel: applyPixel,
  };
  root.MRPForge = Forge;
  if (typeof module !== 'undefined' && module.exports) module.exports = Forge;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ============================================================
 * Metadata Remove Pro Web - Application logic (pure frontend)
 * Copyright (c) 2026. All rights reserved.
 * ============================================================ */
(function (root) {
  'use strict';
  var E = root.MRPEngine, A = root.MRPAntiWM, V = root.MRPVisible, I = root.MRPI18n;
  var T = I.T;
  var items = [];
  var busy = false;
  var PRESET = 'normal';
  var PRESET_DEFAULTS = {
    normal: { visible: false, recompress: false, antiwm: '' },
    deep:   { visible: true,  recompress: true,  antiwm: 'medium' },
  };

  function getEl(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }
  function toast(msg, kind) {
    var t = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    getEl('toasts').appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 3400);
  }
  function verdictText(v) { return T('verdict_' + (v || 'clean')) || v; }
  function kindLabel(k) { return T('kind_' + (k || 'metadata')) || k; }
  function extOf(name) {
    var i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
  }
  var SUPPORTED = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp'];
  var STRIP_OK = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

  // ---- 语言 / 主题 ----
  function applyTheme() {
    var light = localStorage.getItem('mrp-theme') === 'light';
    document.body.classList.toggle('light', light);
    getEl('themebtn').textContent = light ? '🌙' : '☀️';
  }
  function toggleTheme() {
    var light = !document.body.classList.contains('light');
    localStorage.setItem('mrp-theme', light ? 'light' : 'dark');
    applyTheme();
  }
  function applyLang() {
    document.documentElement.lang = I.LANG === 'en' ? 'en' : 'zh-CN';
    document.title = T('app_title');
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = T(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-title]').forEach(function (n) { n.title = T(n.getAttribute('data-i18n-title')); });
    document.querySelectorAll('[data-i18n-tip]').forEach(function (n) { n.setAttribute('data-tip', T(n.getAttribute('data-i18n-tip'))); });
    getEl('langbtn').textContent = I.LANG === 'en' ? '中文' : 'EN';
    renderAll();
  }
  function toggleLang() {
    I.LANG = I.LANG === 'zh' ? 'en' : 'zh';
    localStorage.setItem('mrp-lang', I.LANG);
    applyLang();
  }
  function renderAll() {
    var g = getEl('grid');
    g.innerHTML = '';
    items.forEach(function (it) { renderRow(it, g); });
    updateCounts();
  }

  // ---- 展示辅助 ----
  function metaName(m) {
    var dict = (I.I18N[I.LANG] && I.I18N[I.LANG].xmp_attr) || {};
    if (m.name === 'eXIf') return 'eXIf';
    if (m.name === 'tIME') return 'tIME';
    if (m.name === 'GPSInfo') return 'GPS';
    if (m.name.indexOf('svg_') === 0) return T(m.name);
    if (dict[m.name]) return dict[m.name];
    return m.name;
  }
  function metaValue(m) {
    var keys = ['exif_present', 'last_modified', 'gps_present'];
    if (keys.indexOf(m.value) >= 0) return T(m.value);
    return m.value;
  }
  function findingText(f) {
    if (f.key === 'invisible_wm') {
      var o = f.value || {};
      return T('wm_found', { r: o.ratio }) + (o.hit ? T('wm_hit', { h: o.hit }) : '');
    }
    var raw = f.value;
    if (f.key === 'byte_stream' && f.value === 'found_marker') return T('found_marker', { a: f.arg });
    var i18nKeys = ['found_marker', 'c2pa_chunk', 'jumbf_c2pa', 'xmp_ai_decl', 'svg_comment', 'svg_generator', 'svg_meta'];
    if (i18nKeys.indexOf(raw) >= 0) return T(raw);
    return String(raw);
  }
  function chipsFrom(scan) {
    var box = el('div', 'chips');
    if (!scan || !scan.ok) { box.appendChild(el('div', 'chip danger', T('unable_read'))); return box; }
    var fs = scan.findings || [];
    if (!fs.length) { box.appendChild(el('div', 'chip ok', T('no_traces'))); return box; }
    fs.slice(0, 5).forEach(function (f) {
      var kind = f.kind || 'metadata';
      var cls = (kind === 'ai' || kind === 'c2pa') ? 'danger' : (kind === 'ai_flag' || kind === 'visible') ? 'warn' : '';
      box.appendChild(el('div', 'chip ' + cls, '[' + kindLabel(kind) + '] ' + (f.key === 'invisible_wm' ? T('invisible_wm') : f.key) + ': ' + findingText(f)));
    });
    if (fs.length > 5) box.appendChild(el('div', 'chip', T('more_traces', { n: fs.length - 5 })));
    return box;
  }
  function metaListFrom(scan) {
    var md = el('details', 'metalist');
    var mlist = (scan && scan.metadata) || [];
    md.appendChild(el('summary', null, T('meta_list', { n: mlist.length })));
    if (mlist.length) {
      var ul = el('ul');
      mlist.slice(0, 60).forEach(function (m) {
        var li = el('li');
        li.appendChild(el('b', null, metaName(m) + ': '));
        li.appendChild(document.createTextNode(String(metaValue(m)).replace(/\s+/g, ' ').slice(0, 200)));
        ul.appendChild(li);
      });
      if (mlist.length > 60) ul.appendChild(el('li', 'muted', T('more_traces', { n: mlist.length - 60 })));
      md.appendChild(ul);
    } else {
      md.appendChild(el('div', 'muted', T('no_meta')));
    }
    return md;
  }

  // ---- 扫描 ----
  function wmMode() {
    return PRESET === 'deep' || (PRESET === 'custom' && getEl('opt_antiwm').value !== '');
  }
  async function scanBytes(bytes, ext) {
    var scan;
    if (STRIP_OK.indexOf(ext) >= 0) scan = E.scanImage(bytes, ext);
    else scan = { verdict: 'clean', findings: [], metadata: [], c2pa: false, width: 0, height: 0 };
    if (wmMode()) {
      try {
        var bmp = await createImageBitmap(new Blob([bytes]));
        var c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        var ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        var id = ctx.getImageData(0, 0, c.width, c.height);
        var r = A.detectInvisible(id.data, id.width, id.height);
        if (r.status === 'detected') {
          scan.findings.push({ key: 'invisible_wm', value: { status: 'detected', ratio: r.ratio, hit: r.hit }, kind: 'ai' });
        }
      } catch (e) {}
    }
    var kinds = {};
    scan.findings.forEach(function (f) { kinds[f.kind] = 1; });
    if (scan.c2pa || kinds.ai) scan.verdict = 'high';
    else if (kinds.ai_flag) scan.verdict = 'medium';
    else if (scan.metadata.length || kinds.app || kinds.metadata) scan.verdict = 'low';
    else scan.verdict = 'clean';
    scan.ok = true;
    return scan;
  }

  // ---- 清理 ----
  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode failed')); }, type, quality);
    });
  }
  async function deepClean(bytes, ext, opts) {
    var bmp = await createImageBitmap(new Blob([bytes]));
    var c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    var removed = [];
    if (opts.remove_visible) {
      var id = ctx.getImageData(0, 0, c.width, c.height);
      var boxes = V.detectVisibleGrid(id);
      if (boxes.length) {
        boxes.forEach(function (b) { V.patchVisibleBox(id, b); });
        ctx.putImageData(id, 0, 0);
        removed.push(T('visible') + ' x' + boxes.length);
      }
    }
    var note = '';
    if (opts.anti_wm) {
      c = A.applyAntiWm(c, opts.anti_wm, Math.random);
      var ctx2 = c.getContext('2d');
      var id2 = ctx2.getImageData(0, 0, c.width, c.height);
      var r2 = A.detectInvisible(id2.data, id2.width, id2.height);
      note = (r2.status === 'detected') ? T('verify_still', { r: r2.ratio }) : T('verify_gone');
    }
    removed.push(T('removed_deep', { l: opts.anti_wm || 'light' }));
    var blob, extOut = ext;
    if (ext === 'png') blob = await toBlob(c, 'image/png');
    else if (ext === 'webp') {
      try { blob = await toBlob(c, 'image/webp', 0.92); }
      catch (e) { blob = await toBlob(c, 'image/png'); extOut = 'png'; }
    } else blob = await toBlob(c, 'image/jpeg', 0.93), extOut = 'jpg';
    return { blob: blob, extOut: extOut, removed: removed, note: note };
  }
  async function cleanOne(item, statusEl, btn, actions) {
    busy = true;
    btn.disabled = true;
    statusEl.textContent = T('cleaning');
    statusEl.className = 'status';
    try {
      var bytes = new Uint8Array(await item.file.arrayBuffer());
      var opts = collectOptions();
      var pixelPath = (PRESET === 'deep') || opts.recompress || opts.remove_visible || opts.anti_wm;
      var blob, extOut, removed = [], note = '';
      if (item.ext === 'svg' && pixelPath) {
        var s1 = E.stripSvg(bytes);
        blob = new Blob([s1.data], { type: 'image/svg+xml' });
        extOut = 'svg';
        removed = s1.removed;
        note = T('svg_deep_note');
      } else if (pixelPath) {
        var d = await deepClean(bytes, item.ext, opts);
        blob = d.blob; extOut = d.extOut; removed = d.removed; note = d.note;
      } else if (STRIP_OK.indexOf(item.ext) >= 0) {
        var s = E.stripImage(bytes, item.ext);
        if (!s) throw new Error('unsupported');
        blob = new Blob([s.data], { type: item.file.type || 'application/octet-stream' });
        extOut = item.ext;
        removed = s.removed;
      } else {
        // gif/bmp: 无字节级剥离, 经 canvas 重编码去元数据
        var d2 = await deepClean(bytes, item.ext, { remove_visible: false, recompress: true, anti_wm: '' });
        blob = d2.blob; extOut = d2.extOut; removed = d2.removed;
      }
      var outBytes = new Uint8Array(await blob.arrayBuffer());
      var rescan = await scanBytes(outBytes, extOut === 'png' ? 'png' : (extOut === 'jpg' ? 'jpg' : (extOut === 'webp' ? 'webp' : extOut)));
      item.cleaned = { blob: blob, name: item.name.replace(/\.[^.]+$/, '') + '.' + extOut, scan: rescan, removed: removed, note: note, sizeOut: blob.size };
      var v = rescan.verdict;
      statusEl.textContent = T('cleaned') + ' · ' + T('rescan') + verdictText(v);
      statusEl.className = 'status ok';
      var row = findRow(item);
      var pill = row ? row.querySelector('.pill') : null;
      if (pill) { pill.className = 'pill ' + (v || 'clean'); pill.textContent = verdictText(v || 'clean') + ' · ' + T('after_clean'); }
      var chips = row ? row.querySelector('.chips') : null;
      if (chips) {
        chips.innerHTML = '';
        chips.appendChild(el('div', 'chip ok', '✓ ' + T('cleared_chip') + (removed.length ? removed.join('、') : T('all_traces'))));
        if (item.size !== blob.size) {
          var diff = blob.size - item.size;
          var pct = Math.round(Math.abs(diff) / Math.max(1, item.size) * 100);
          chips.appendChild(el('div', 'chip', T('size_change', { a: fmtSize(item.size), b: fmtSize(blob.size), p: pct, d: diff < 0 ? T('saved') : T('added') })));
        }
        if (note) chips.appendChild(el('div', 'chip', note));
      }
      if (item.cleaned && actions) {
        var a = el('a', 'btn small', T('download_btn'));
        a.href = URL.createObjectURL(item.cleaned.blob);
        a.setAttribute('download', item.cleaned.name);
        actions.appendChild(a);
      }
      toast(item.name + T('clean_done'), 'ok');
    } catch (e) {
      statusEl.textContent = T('failed') + (e && e.message || '?');
      statusEl.className = 'status err';
      toast(T('toast_clean_failed') + item.name, 'err');
    } finally {
      busy = false; btn.disabled = false;
    }
  }
  async function cleanAll() {
    if (busy) return;
    var wrap = getEl('progresswrap'), bar = getEl('progressbar');
    wrap.style.display = 'block';
    busy = true;
    for (var i = 0; i < items.length; i++) {
      bar.style.width = (i / items.length * 100) + '%';
      var row = findRow(items[i]);
      var status = row ? row.querySelector('.status') : null;
      var btn = row ? row.querySelector('.btn.small') : null;
      var actions = row ? row.querySelector('.ractions') : null;
      if (status && btn) await cleanOne(items[i], status, btn, actions);
      bar.style.width = ((i + 1) / items.length * 100) + '%';
    }
    wrap.style.display = 'none';
    busy = false;
    toast(T('all_done'), 'ok');
  }

  // ---- 渲染 ----
  function findRow(item) {
    var rows = getEl('grid').querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) {
      var n = rows[i].querySelector('.rname');
      if (n && n.textContent === item.name) return rows[i];
    }
    return null;
  }
  function verdictPill(scan) {
    var p = el('span', 'pill');
    if (!scan || !scan.ok) { p.className = 'pill err'; p.textContent = T('reading_failed'); return p; }
    p.className = 'pill ' + (scan.verdict || 'clean');
    p.textContent = verdictText(scan.verdict);
    return p;
  }
  function renderRow(item, container) {
    var row = el('div', 'row');
    var t = el('div', 'rthumb');
    var purl = item.url;
    if (item.isImage) {
      var im = el('img');
      im.src = purl; im.loading = 'lazy'; im.draggable = false;
      t.appendChild(im);
    } else t.appendChild(el('div', 'file-ico', '📄'));
    row.appendChild(t);
    var info = el('div', 'rinfo');
    info.appendChild(el('div', 'rname', item.name));
    var meta = el('div', 'rmeta');
    meta.appendChild(verdictPill(item.scan));
    meta.appendChild(el('span', 'badge', item.ext.toUpperCase()));
    meta.appendChild(el('span', 'badge', fmtSize(item.size)));
    var dt = el('button', 'rdetail', 'ⓘ ' + T('details') + ' ▾');
    var dbody = el('div', 'rdetails');
    dbody.appendChild(chipsFrom(item.scan));
    dbody.appendChild(metaListFrom(item.scan));
    dt.onclick = function () {
      var open = dbody.style.display !== 'none';
      dbody.style.display = open ? 'none' : 'block';
      dt.textContent = 'ⓘ ' + T('details') + (open ? ' ▾' : ' ▴');
    };
    meta.appendChild(dt);
    info.appendChild(meta);
    info.appendChild(dbody);
    row.appendChild(info);
    var ra = el('div', 'ractions');
    var status = el('div', 'status', '');
    ra.appendChild(status);
    var bClean = el('button', 'btn small', T('clean_btn'));
    bClean.onclick = function () { if (!busy) cleanOne(item, status, bClean, ra); };
    ra.appendChild(bClean);
    var bDel = el('button', 'icon-btn', '✕');
    bDel.title = T('remove_btn');
    bDel.onclick = function () {
      items = items.filter(function (x) { return x.id !== item.id; });
      if (item.url) URL.revokeObjectURL(item.url);
      row.remove();
      updateCounts();
    };
    ra.appendChild(bDel);
    row.appendChild(ra);
    container.appendChild(row);
  }
  function updateCounts() {
    getEl('count').textContent = items.length ? T('added_n', { n: items.length }) : '';
    getEl('empty').style.display = items.length ? 'none' : '';
  }

  // ---- 上传 ----
  function uploadFiles(fileList) {
    if (busy) return;
    busy = true;
    toast(T('toast_uploading', { n: fileList.length }));
    var jobs = [];
    for (var i = 0; i < fileList.length; i++) {
      (function (file) {
        jobs.push(file.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf);
          var ext = extOf(file.name);
          if (SUPPORTED.indexOf(ext) < 0) return null;
          return scanBytes(bytes, ext).then(function (scan) {
            return { id: 'f' + (++uid), file: file, name: file.name, size: file.size, ext: ext,
              scan: scan, isImage: true, url: URL.createObjectURL(file) };
          });
        }));
      })(fileList[i]);
    }
    Promise.all(jobs).then(function (res) {
      res.forEach(function (it) { if (it) items.push(it); });
      getEl('empty').style.display = 'none';
      renderAll();
      toast(T('toast_added', { n: res.filter(Boolean).length }), 'ok');
    }).finally(function () { busy = false; getEl('fileinput').value = ''; });
  }
  var uid = 0;

  // ---- 预设 / 抽屉 ----
  function setInputs(map) {
    getEl('opt_visible').checked = !!map.visible;
    getEl('opt_recompress').checked = !!map.recompress;
    getEl('opt_antiwm').value = map.antiwm || '';
  }
  function collectOptions() {
    return {
      recompress: getEl('opt_recompress').checked,
      remove_visible: getEl('opt_visible').checked,
      anti_wm: getEl('opt_antiwm').value || '',
    };
  }
  function pickPreset(p) {
    PRESET = p;
    setInputs(PRESET_DEFAULTS[p] || PRESET_DEFAULTS.normal);
    updatePills();
    rescanAll();
  }
  function markCustom() { PRESET = 'custom'; updatePills(); rescanAll(); }
  function updatePills() {
    document.querySelectorAll('.pill-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-preset') === PRESET);
    });
    getEl('preset_hint').textContent = PRESET === 'custom' ? T('custom') : '';
  }
  function rescanAll() {
    if (!items.length) return;
    items.forEach(function (it) {
      it.file.arrayBuffer().then(function (buf) {
        return scanBytes(new Uint8Array(buf), it.ext);
      }).then(function (scan) {
        it.scan = scan;
        renderAll();
      });
    });
  }
  function toggleDrawer(force) {
    var open = force !== undefined ? force : !getEl('drawer').classList.contains('open');
    getEl('drawer').classList.toggle('open', open);
    getEl('overlay').classList.toggle('show', open);
  }

  // ---- 初始化 ----
  function init() {
    var dz = getEl('dropzone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) { uploadFiles(e.dataTransfer.files); });
    dz.addEventListener('click', function () { getEl('fileinput').click(); });
    getEl('browsebtn').onclick = function (e) { e.stopPropagation(); getEl('fileinput').click(); };
    getEl('fileinput').addEventListener('change', function (e) { uploadFiles(e.target.files); });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
    ['opt_visible', 'opt_recompress', 'opt_antiwm'].forEach(function (id) {
      getEl(id).addEventListener('change', markCustom);
    });
    pickPreset('normal');
    applyLang();
    applyTheme();
    console.log('%c Metadata Remove Pro %c (c) 2026 - All Rights Reserved ',
      'background:#6366f1;color:#fff;padding:3px 8px;border-radius:6px 0 0 6px;',
      'background:#22d3ee;color:#0b0e14;padding:3px 8px;border-radius:0 6px 6px 0;');
  }
  root.MRPApp = { init: init, uploadFiles: uploadFiles, cleanAll: cleanAll, pickPreset: pickPreset, toggleDrawer: toggleDrawer, toggleLang: toggleLang, toggleTheme: toggleTheme };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MRPApp;
})(typeof globalThis !== 'undefined' ? globalThis : this);

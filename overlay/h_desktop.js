/* ============ lapisan desktop: bahasa, simpan native, tentang, update, changelog ============ */
const AND = window.AndroidBridge || null;
function androidNative() {
  const cbs = {}; let seq = 0, saveWait = null, openCb = null;
  window.__andCb = (id, ok, payload) => { const c = cbs[id]; if (c) { delete cbs[id]; c(ok, payload); } };
  window.__andSaveReady = ok => { if (saveWait) { const w = saveWait; saveWait = null; w(ok); } };
  window.__andOpen = async (url, name) => { try { const r = await fetch(url); const buf = new Uint8Array(await r.arrayBuffer()); if (openCb) openCb({ name, data: buf }); } catch (e) { toast(String((e && e.message) || e), { kind: 'err' }); } };
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x6000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x6000)); return btoa(s); };
  let info = {}; try { info = JSON.parse(AND.info()); } catch (e) { }
  return {
    info, setLang() { }, ready() { AND.ready(); }, onMenu() { }, onOpenFile(cb) { openCb = cb; },
    openExternal(u) { AND.openUrl(u); return Promise.resolve(true); },
    checkUpdate(url) { return new Promise(res => { const id = 'c' + (++seq); cbs[id] = (ok, payload) => res(ok ? { ok: true, text: payload } : { ok: false, error: payload }); AND.httpGet(id, url); }); },
    saveFile(name, data) {
      return new Promise((res, rej) => {
        saveWait = ok => {
          if (!ok) { res({ status: 'declined' }); return; }
          try { const CH = 0x60000; for (let i = 0; i < data.length; i += CH) AND.saveChunk(b64(data.subarray(i, i + CH))); AND.saveFinish(); res({ status: 'saved' }); }
          catch (e) { try { AND.saveAbort(); } catch (_) { } rej(e); }
        };
        AND.saveStart(name);
      });
    }
  };
}
const NAT = window.native || (AND ? androidNative() : null);
const APP_VERSION = (NAT && NAT.info && NAT.info.version) || '1.0.0';
const DEFAULT_UPDATE_URL = '__UPDATE_URL__';
const CHANGELOG = [
  { v: '1.0.0', date: '2026-10-12',
    id: ['Rilis pertama versi desktop: installer Windows, portable .exe, serta zip untuk Linux dan Mac.', 'Dua bahasa: Indonesia dan Inggris, bisa diganti dari menu Bahasa atau tombol ID/EN.', 'Simpan dan buka file lewat dialog sistem; hasil ekspor .apkg langsung berekstensi .apkg.', 'Buka file .apkg lewat klik dua kali atau tarik-lepas ke jendela.', 'Menu aplikasi, dialog Tentang, Changelog, dan Cek pembaruan.', 'Semua pustaka disertakan, jadi bisa dipakai tanpa internet.', 'Versi Android (APK, Android 7.0 ke atas) dengan tombol kembali dan menu Buka dengan.'],
    en: ['First desktop release: Windows installer, portable .exe, and zip builds for Linux and Mac.', 'Two languages: Indonesian and English, switchable from the Language menu or the ID/EN button.', 'Open and save files through native system dialogs; exported .apkg packages are saved with the .apkg extension.', 'Open .apkg files by double-clicking them or dragging them onto the window.', 'Application menu, About dialog, Changelog, and Check for updates.', 'All libraries are bundled, so it works without an internet connection.', 'Android version (APK, Android 7.0 and up) with back-button support and Open with.'] },
  { v: '0.2.0', date: '2026-10-09',
    id: ['Versi web: cadangan simpan file lewat dialog sistem, tombol unduh, dan tab baru.'],
    en: ['Web version: fallback ways to save files through the system dialog, a download button, and a new tab.'] },
  { v: '0.1.0', date: '2026-10-09',
    id: ['Versi web pertama: buka dan edit .apkg, CSV, TXT; editor field, cloze, tag, deck, tipe catatan, media, cari & ganti, duplikat, undo/redo, ekspor.'],
    en: ['First web version: open and edit .apkg, CSV, TXT; field editor, cloze, tags, decks, note types, media, find & replace, duplicates, undo/redo, export.'] }
];

/* ---------- bahasa ---------- */
let LANG = (NAT && NAT.lang) || lsGet('ade-lang') || ((navigator.language || '').toLowerCase().startsWith('id') ? 'id' : 'en');
if (LANG !== 'id' && LANG !== 'en') LANG = 'en';
const ENKEYS = Object.keys(EN).sort((a, b) => b.length - a.length);
const isW = ch => /[\p{L}\p{N}]/u.test(ch);
const ENRE = new RegExp(ENKEYS.map(k => (isW(k[0]) ? '(?<![\\p{L}\\p{N}])' : '') + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (isW(k[k.length - 1]) ? '(?![\\p{L}\\p{N}])' : '')).join('|'), 'gu');
const trCache = new Map();
function trStr(s) {
  if (!s || LANG !== 'en') return s;
  let r = trCache.get(s); if (r !== undefined) return r;
  r = s.replace(ENRE, m => EN[m] !== undefined ? EN[m] : m); if (trCache.size > 4000) trCache.clear(); trCache.set(s, r); return r;
}
const STATIC_IN_DATA = new Set(['(kosong)', '(ada yang ditangguhkan)']);
function inData(el) { return el && el.closest && el.closest('#tbody, [contenteditable], textarea, input, script, style, .notr'); }
const tMap = new WeakMap();
function trTextNode(n) {
  const p = n.parentElement; if (!p) return;
  const e = tMap.get(n); if (!e && LANG !== 'en') return;
  const orig = (e && n.data === e.last) ? e.orig : n.data;
  if (inData(p) && !STATIC_IN_DATA.has(orig.trim())) return;
  const out = LANG === 'en' ? trStr(orig) : orig;
  if (out !== n.data) n.data = out;
  tMap.set(n, { orig, last: out });
}
const aMap = new WeakMap(); const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
function trAttrs(el) {
  if (el.parentElement && el.parentElement.closest('#tbody, [contenteditable], .notr')) return;
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue; const cur = el.getAttribute(a);
    let m = aMap.get(el); if (!m) { if (LANG !== 'en') continue; m = {}; aMap.set(el, m); }
    const e = m[a]; const orig = (e && cur === e.last) ? e.orig : cur;
    const out = LANG === 'en' ? trStr(orig) : orig; if (out !== cur) el.setAttribute(a, out); m[a] = { orig, last: out };
  }
}
function trTree(root) {
  if (root.nodeType === 3) { trTextNode(root); return; }
  if (root.nodeType !== 1) return;
  if (root.matches && root.matches('script,style')) return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null);
  let n = w.nextNode();
  while (n) { if (n.nodeType === 3) trTextNode(n); else if (n.nodeType === 1) { if (n.matches('script,style')) { n = w.nextSibling() || w.nextNode(); continue; } trAttrs(n); } n = w.nextNode(); }
}
let trQueue = new Set(); let trTimer = 0;
const mo = new MutationObserver(list => {
  for (const m of list) {
    if (m.type === 'childList') m.addedNodes.forEach(x => trQueue.add(x));
    else if (m.type === 'characterData') trQueue.add(m.target);
    else if (m.type === 'attributes') trQueue.add(m.target);
  }
  if (!trTimer) trTimer = requestAnimationFrame(() => { trTimer = 0; const q = trQueue; trQueue = new Set(); mo.disconnect(); try { q.forEach(x => { if (x.isConnected) { if (x.nodeType === 1 && x.hasAttribute && !x.firstChild) trAttrs(x); else trTree(x); } }); } finally { observe(); } });
});
function observe() { mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }
function setLang(l, silent) {
  LANG = l; lsSet('ade-lang', l); document.documentElement.lang = l;
  mo.disconnect(); try { trTree(document.body); } finally { observe(); }
  const b = $('#btn-lang'); if (b) b.textContent = l.toUpperCase();
  if (NAT) NAT.setLang(l);
  if (!silent) toast(l === 'en' ? 'Language: English' : 'Bahasa: Indonesia');
}

/* ---------- simpan native ---------- */
async function saveBlob(filename, data) {
  if (NAT) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const r = await NAT.saveFile(filename, buf);
    return r.status === 'saved' ? 'saved' : 'declined';
  }
  return saveBlobWeb(filename, data);
}

/* ---------- versi ---------- */
function cmpVer(a, b) {
  const pa = String(a).replace(/^v/i, '').split(/[.\-+]/).map(x => parseInt(x, 10) || 0), pb = String(b).replace(/^v/i, '').split(/[.\-+]/).map(x => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
function openExt(url) { if (NAT) NAT.openExternal(url); else window.open(url, '_blank', 'noopener'); }
function getUpdateUrl() { return (lsGet('ade-update-url') || DEFAULT_UPDATE_URL || '').trim(); }
async function fetchUpdate(url) {
  let text;
  if (NAT) { const r = await NAT.checkUpdate(url); if (!r.ok) throw new Error(r.error); text = r.text; }
  else { const res = await fetch(url, { headers: { Accept: 'application/json' } }); if (!res.ok) throw new Error('HTTP ' + res.status); text = await res.text(); }
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error('Respons bukan JSON yang valid.'); }
  const version = String(j.version || j.tag_name || '').replace(/^v/i, ''); if (!version) throw new Error('Respons tidak memuat nomor versi.');
  let notes = j.notes || j.changelog || j.body || ''; if (notes && !Array.isArray(notes) && typeof notes === 'object') notes = notes[LANG] || notes.en || notes.id || '';
  if (typeof notes === 'string') notes = notes.split(/\r?\n/).map(s => s.replace(/^[\s\-*•]+/, '').trim()).filter(Boolean);
  const link = String(j.url || j.download_url || j.html_url || '');
  return { version, notes: notes.map(String), url: /^https:\/\//i.test(link) ? link : '', date: String(j.date || j.published_at || '').slice(0, 10), newer: cmpVer(version, APP_VERSION) > 0 };
}

/* ---------- dialog ---------- */
function dlgAbout() {
  const i = (NAT && NAT.info) || {};
  const row = (k, v) => h('tr', null, h('td', { class: 'muted', text: k }), h('td', { text: v }));
  const plat = { win32: 'Windows', darwin: 'macOS', linux: 'Linux', android: 'Android' }[i.platform] || (i.platform || 'Web');
  const eng = i.platform === 'android' ? [row('Android', (i.androidRelease || '-') + ' (API ' + (i.sdk || '?') + ')'), row('WebView', i.chrome || '-')] : [row('Electron', i.electron || '-'), row('Chromium', i.chrome || '-'), row('Node.js', i.node || '-')];
  openModal({
    title: 'Tentang', body: [
      h('div', { style: { textAlign: 'center', padding: '4px 0 10px' } }, h('div', { style: { fontSize: '20px', fontWeight: 600 }, text: 'Editor Deck Anki' }), h('div', { class: 'muted', text: 'Versi ' + APP_VERSION })),
      h('p', { text: 'Editor deck Anki dengan tampilan GUI: buka, edit, dan ekspor file .apkg, CSV, dan TXT. Semua pemrosesan terjadi di komputer kamu.' }),
      h('table', { class: 'tbl' }, h('tbody', null,
        row('Versi', APP_VERSION + (i.portable ? ' (portable)' : '')), row('Platform', plat + (i.arch ? ' ' + i.arch : '')),
        ...eng,
        row('Pustaka', 'sql.js 1.8.0 (MIT), JSZip 3.10.1 (MIT)'), row('Lisensi', 'MIT'), row('Dibuat dengan', 'Claude (Anthropic)'))),
      h('div', { class: 'note', text: 'Anki adalah merek dagang pemiliknya. Aplikasi ini bukan produk resmi Anki dan tidak berafiliasi dengan Anki.' })],
    actions: [{ label: 'Changelog', onClick: () => { setTimeout(dlgChangelog, 0); } }, { label: 'Cek pembaruan', onClick: () => { setTimeout(() => dlgUpdate(), 0); } }, { label: 'Tutup', kind: 'primary' }]
  });
}
function dlgChangelog() {
  const body = CHANGELOG.map(c => h('div', { style: { marginBottom: '14px' } },
    h('h3', { style: { fontSize: '14px', margin: '0 0 4px' }, text: 'v' + c.v + '  ·  ' + c.date + (c.v === APP_VERSION ? '  (' + (LANG === 'en' ? 'current' : 'saat ini') + ')' : '') }),
    h('ul', { style: { margin: 0, paddingLeft: '20px' } }, (LANG === 'en' ? c.en : c.id).map(t => h('li', { class: 'notr', text: t })))));
  openModal({ title: 'Changelog', wide: true, body, actions: [{ label: 'Tutup', kind: 'primary' }] });
}
function dlgUpdate(preset) {
  const urlI = h('input', { type: 'text', value: getUpdateUrl(), placeholder: 'https://…/latest.json', 'aria-label': 'Alamat pembaruan', class: 'mono' });
  const auto = h('input', { type: 'checkbox', checked: lsGet('ade-update-auto') === '1' ? true : null });
  const out = h('div', { style: { marginTop: '10px' } });
  const show = (kind, nodes) => { out.replaceChildren(h('div', { class: 'note ' + kind }, nodes)); };
  const run = async () => {
    const url = urlI.value.trim(); lsSet('ade-update-url', url); lsSet('ade-update-auto', auto.checked ? '1' : '0');
    if (!url) { show('warn', 'Alamat pembaruan belum diisi. Isi alamat file JSON (misalnya latest.json di hosting kamu atau API rilis GitHub), lalu tekan Cek sekarang.'); return false; }
    show('', 'Memeriksa…');
    try {
      const r = await fetchUpdate(url);
      if (!r.newer) { show('ok', 'Kamu sudah memakai versi terbaru (' + APP_VERSION + ').'); return false; }
      const nodes = [h('strong', { text: 'Versi baru tersedia: ' + r.version }), r.date ? h('span', { class: 'muted', text: '  (' + r.date + ')' }) : null,
        r.notes.length ? h('ul', { style: { margin: '6px 0 0', paddingLeft: '20px' } }, r.notes.slice(0, 12).map(t => h('li', { class: 'notr', text: t }))) : null,
        r.url ? h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn primary', type: 'button', onclick: () => openExt(r.url) }, 'Buka halaman unduh')) : null];
      show('warn', nodes);
    } catch (e) { show('err', 'Gagal memeriksa pembaruan: ' + ((e && e.message) || e)); }
    return false;
  };
  openModal({
    title: 'Cek pembaruan', wide: true, body: [
      h('p', null, 'Versi terpasang: ' + APP_VERSION),
      field('Alamat pembaruan (file JSON)', urlI, 'Format: {"version":"1.1.0","url":"https://…","date":"2026-11-01","notes":{"id":["…"],"en":["…"]}}. API rilis GitHub (…/releases/latest) juga bisa.'),
      h('label', { class: 'check' }, auto, 'Cek otomatis saat aplikasi dibuka'), out],
    actions: [{ label: 'Tutup' }, { label: 'Cek sekarang', kind: 'primary', onClick: run }]
  });
  if (preset) { out.replaceChildren(); }
}
async function autoCheckUpdate() {
  if (lsGet('ade-update-auto') !== '1') return; const url = getUpdateUrl(); if (!url) return;
  try { const r = await fetchUpdate(url); if (r.newer) toast((LANG === 'en' ? 'New version available: ' : 'Versi baru tersedia: ') + r.version, { ms: 12000, action: { label: LANG === 'en' ? 'Details' : 'Rincian', fn: () => dlgUpdate() } }); } catch (e) { }
}

/* ---------- tombol kembali Android ---------- */
window.__androidBack = function () {
  if ($$('.modal-back').length || $$('.menu').length) { $$('.menu').forEach(m => m.remove()); if ($$('.modal-back').length) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'handled'; }
  const b = $('.body'); if (b && b.classList.contains('side-open')) { b.classList.remove('side-open'); return 'handled'; }
  if (UI.mode === 'add' || UI.sel.size) { const x = $('.editor-close'); if (UI.mode === 'add' && x) x.click(); else { UI.sel.clear(); refresh({ editor: true }); } return 'handled'; }
  if (C && C.dirty && C.kind !== 'sample') {
    openModal({ title: 'Ada perubahan yang belum disimpan', body: [h('p', { text: 'Keluar dari aplikasi dan buang perubahan itu?' })], actions: [{ label: 'Batal' }, { label: 'Keluar & buang', kind: 'primary', onClick: () => { if (AND) AND.exit(); } }] });
    return 'handled';
  }
  return 'exit';
};

/* ---------- menu aplikasi dan hook ---------- */
function openAppMenu(anchor) {
  openMenu(anchor, [
    { label: 'Bahasa Indonesia' + (LANG === 'id' ? '  ✓' : ''), icon: 'eye', onClick: () => setLang('id') },
    { label: 'English' + (LANG === 'en' ? '  ✓' : ''), icon: 'eye', onClick: () => setLang('en') }, { sep: true },
    { label: 'Bantuan', icon: 'help', onClick: dlgHelp }, { label: 'Changelog', icon: 'list', onClick: dlgChangelog },
    { label: 'Cek pembaruan', icon: 'download', onClick: () => dlgUpdate() }, { label: 'Tentang', icon: 'alert', onClick: dlgAbout }]);
}
function setupDesktop() {
  document.documentElement.lang = LANG;
  const theme = $('#btn-theme'); if (theme && !$('#btn-lang')) {
    const b = h('button', { class: 'btn ghost', id: 'btn-lang', type: 'button', title: 'Bahasa / Language', 'aria-label': 'Bahasa / Language' }, LANG.toUpperCase());
    b.addEventListener('click', e => openAppMenu(e.currentTarget)); theme.parentNode.insertBefore(b, theme);
  }
  const ACT = { open: () => $('#btn-open').click(), new: () => $('#btn-new').click(), import: () => $('#btn-import').click(), save: () => dlgExport(), undo: doUndo, redo: doRedo, find: () => $('#btn-find').click(), help: dlgHelp, about: dlgAbout, changelog: dlgChangelog, update: () => dlgUpdate(), theme: () => $('#btn-theme').click(), 'lang-id': () => setLang('id'), 'lang-en': () => setLang('en') };
  if (NAT) {
    NAT.onMenu(id => { if ($('.modal-back') && !/^(about|changelog|update|help|lang-)/.test(id)) return; const f = ACT[id]; if (f) f(); });
    NAT.onOpenFile(f => { openFile(new File([f.data], f.name)); });
    NAT.ready();
  }
  trTree(document.body); observe();
  if (NAT) NAT.setLang(LANG);
  setTimeout(autoCheckUpdate, 2500);
}
document.addEventListener('DOMContentLoaded', () => { const w = () => { if (window.__app && $('#btn-theme')) setupDesktop(); else setTimeout(w, 50); }; w(); });

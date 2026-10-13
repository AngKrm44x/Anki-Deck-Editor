'use strict';
/* ============ util ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat(2)) { if (k == null || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return el;
}
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>', chevD: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5.5M14 11v5.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>', upload: '<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19.5h14"/>',
  folder: '<path d="M3.5 6.5h5.8l2 2.2h9.2v10.3h-17z"/>', folderPlus: '<path d="M3.5 6.5h5.8l2 2.2h9.2v10.3h-17z"/><path d="M12 11.5v5M9.5 14h5"/>',
  tag: '<path d="M3.5 12V4.5H11l9.5 9.5-7 7z"/><circle cx="7.8" cy="8.3" r="1.2"/>',
  pencil: '<path d="M4 20l1-4.2L16.3 4.5l3.2 3.2L8.2 19z"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-3a1 1 0 00-1-1h-9a1 1 0 00-1 1v9a1 1 0 001 1h3"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 019.5 4.5a8 8 0 1010 10z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  file: '<path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z"/><path d="M14 3.5V8h4.5"/>',
  replace: '<path d="M4 8h12.5M13 4.5L16.5 8 13 11.5M20 16H7.5M11 12.5L7.5 16 11 19.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  list: '<path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 114 1.7c-.8.7-1.7 1.1-1.7 2.3M12 16.5h.01"/>',
  stats: '<path d="M5 19.5V11M12 19.5V5M19 19.5v-6.5"/>',
  save: '<path d="M5 4.5h11l3.5 3.5v11.5H5z"/><path d="M8 4.5v5h7v-5M8 19.5v-6h8v6"/>',
  grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
  layers: '<path d="M12 4l9 4.8-9 4.8-9-4.8z"/><path d="M3 12.5l9 4.8 9-4.8"/>',
  arrowUp: '<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>', arrowDown: '<path d="M12 5v13M6.5 12.5L12 18l5.5-5.5"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>'
};
function icon(n, s) {
  const d = document.createElement('span'); d.className = 'ic';
  d.innerHTML = `<svg viewBox="0 0 24 24" width="${s || 16}" height="${s || 16}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  return d;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _ta = document.createElement('textarea');
function decodeEntities(s) { if (s.indexOf('&') < 0) return s; _ta.innerHTML = s; return _ta.value; }
function stripHtml(s) {
  s = String(s == null ? '' : s);
  if (s.indexOf('<') >= 0 || s.indexOf('&') >= 0) {
    s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(div|p|li|tr|h\d)>/gi, ' ').replace(/<[^>]*>/g, '');
    s = decodeEntities(s);
  }
  return s.replace(/\s+/g, ' ').trim();
}
const sec = () => Math.floor(Date.now() / 1000);
let _lastId = 0;
function newId() { let t = Date.now(); if (t <= _lastId) t = _lastId + 1; _lastId = t; return t; }
const B91 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
function genGuid() {
  const a = new Uint32Array(2); crypto.getRandomValues(a);
  let n = (BigInt(a[0]) << 32n) | BigInt(a[1]); let s = '';
  if (n === 0n) return B91[0];
  while (n > 0n) { s = B91[Number(n % 91n)] + s; n /= 91n; }
  return s;
}
function sha1(bytes) {
  const l = bytes.length, padLen = (((l + 8) >> 6) + 1) * 64;
  const buf = new Uint8Array(padLen); buf.set(bytes); buf[l] = 0x80;
  const dv = new DataView(buf.buffer); const nb = l * 8;
  dv.setUint32(padLen - 4, nb >>> 0); dv.setUint32(padLen - 8, Math.floor(nb / 4294967296));
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0; const w = new Uint32Array(80);
  for (let i = 0; i < padLen; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
    for (let j = 16; j < 80; j++) { const x = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]; w[j] = (x << 1) | (x >>> 31); }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      let f, k;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; } else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; } else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) >>> 0; e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4];
}
const csumOf = s => sha1(new TextEncoder().encode(stripHtml(s)))[0];
function naturalCmp(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); }
function fmtDate(sOrMs, isMs) { const d = new Date(isMs ? sOrMs : sOrMs * 1000); return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
function fmtBytes(n) { if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
function baseName(fn) { return String(fn || 'deck').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'deck'; }
class UserError extends Error { }
const parseTags = s => String(s || '').split(/\s+/).filter(Boolean);
const tagsToStr = a => a.length ? ' ' + a.join(' ') + ' ' : '';
const BAD_TAGS = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'STYLE', 'FRAME', 'FRAMESET']);
function sanitizeHtml(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  (function walk(n) {
    for (const c of Array.from(n.children)) {
      if (BAD_TAGS.has(c.tagName)) { c.remove(); continue; }
      for (const a of Array.from(c.attributes)) {
        const nm = a.name.toLowerCase();
        if (nm.startsWith('on') || nm === 'srcdoc' || nm === 'formaction' ||
          ((nm === 'href' || nm === 'src' || nm === 'xlink:href' || nm === 'action') && /^\s*(javascript|vbscript):/i.test(a.value)) ||
          (nm === 'src' && /^\s*data:text\/html/i.test(a.value))) c.removeAttribute(a.name);
      }
      walk(c);
    }
  })(t.content);
  return t.innerHTML;
}
/* delimited text */
function parseDelimited(text, sep) {
  const rows = []; let row = [], f = '', q = false, i = 0; const n = text.length;
  if (text.charCodeAt(0) === 0xFEFF) i = 1;
  for (; i < n; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"' && f === '') q = true;
    else if (ch === sep) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}
function toDelimited(rows, sep) {
  const q = v => { v = String(v == null ? '' : v); return (v.includes(sep) || v.includes('"') || v.includes('\n') || v.includes('\r')) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return rows.map(r => r.map(q).join(sep)).join('\n') + '\n';
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

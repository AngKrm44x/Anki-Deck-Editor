/* ============ terjemah otomatis (isi field belakang kartu) ============ */
class TrError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const TR_LANGS = [['auto', 'Deteksi otomatis'], ['ja', 'Jepang'], ['en', 'Inggris'], ['id', 'Indonesia'], ['ms', 'Melayu'], ['zh', 'Mandarin'], ['ko', 'Korea'], ['ar', 'Arab'], ['es', 'Spanyol'], ['fr', 'Prancis'], ['de', 'Jerman'], ['pt', 'Portugis'], ['ru', 'Rusia'], ['hi', 'Hindi'], ['th', 'Thai'], ['vi', 'Vietnam']];
const TR_PROVIDERS = [['mymemory', 'MyMemory (gratis, tanpa kunci)'], ['jisho', 'Jisho (kamus Jepang ke Inggris, hanya aplikasi)'], ['libre', 'LibreTranslate (alamat sendiri)'], ['google', 'Google Cloud Translation (kunci API)'], ['deepl', 'DeepL (kunci API, hanya aplikasi)']];
const TR_SEPS = [[' - ', 'spasi tanda hubung ( - )'], [' / ', 'garis miring ( / )'], ['; ', 'titik koma (; )'], [' ', 'spasi'], ['<br>', 'baris baru']];
const TR_DEFAULT = { provider: 'mymemory', sl: 'ja', tl: 'id', mode: 'append', sep: ' - ', src: '', mmEmail: '', libreUrl: '', libreKey: '', googleKey: '', deeplKey: '' };
function trPrefs() { let p = {}; try { p = JSON.parse(lsGet('ade-tr') || '{}') || {}; } catch (e) { p = {}; } return Object.assign({}, TR_DEFAULT, p); }
function trSave(p) { lsSet('ade-tr', JSON.stringify(p)); }

/* ---------- jaringan ---------- */
async function httpRequest(spec) {
  if (typeof NAT !== 'undefined' && NAT && NAT.httpRequest) { const r = await NAT.httpRequest(spec); if (!r || r.error) throw new TrError('net', 'Tidak bisa terhubung ke layanan terjemahan: ' + ((r && r.error) || 'tanpa respons')); return r; }
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(spec.url, { method: spec.method || 'GET', headers: spec.headers || {}, body: spec.body == null ? undefined : spec.body, signal: ctl.signal });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e) { throw new TrError('net', 'Tidak bisa terhubung ke layanan terjemahan. Periksa internet, atau pakai aplikasi desktop/Android jika browser memblokir.'); }
  finally { clearTimeout(t); }
}
const enc = encodeURIComponent;
function trHttpCheck(r, who) {
  if (r.status === 429 || r.status === 456) throw new TrError('quota', who + ': kuota habis atau terlalu banyak permintaan (HTTP ' + r.status + ').');
  if (r.status === 401 || r.status === 403) throw new TrError('auth', who + ': kunci API ditolak (HTTP ' + r.status + ').');
  if (!r.ok) throw new TrError('bad', who + ': HTTP ' + r.status + '.');
}
function trJson(r, who) { try { return JSON.parse(r.text); } catch (e) { throw new TrError('bad', who + ': respons bukan JSON.'); } }
const zhMap = c => c === 'zh' ? 'zh-CN' : c;

const TR_IMPL = {
  async mymemory(t, sl, tl, p) {
    if (sl === tl) throw new TrError('bad', 'Bahasa asal dan tujuan sama.');
    const pair = (sl === 'auto' ? 'Autodetect' : zhMap(sl)) + '|' + zhMap(tl);
    const r = await httpRequest({ url: 'https://api.mymemory.translated.net/get?q=' + enc(t) + '&langpair=' + enc(pair) + (p.mmEmail ? '&de=' + enc(p.mmEmail) : '') });
    if (r.status === 429) throw new TrError('quota', 'MyMemory: kuota harian habis. Isi email di pengaturan untuk kuota lebih besar, atau coba besok.');
    const j = trJson(r, 'MyMemory'); const out = j && j.responseData && j.responseData.translatedText;
    if (String(j.responseStatus) === '429' || /MYMEMORY WARNING/i.test(out || '')) throw new TrError('quota', 'MyMemory: kuota harian habis. Isi email di pengaturan untuk kuota lebih besar, atau coba besok.');
    if (String(j.responseStatus) !== '200' || !out) throw new TrError('bad', 'MyMemory: ' + (j.responseDetails || 'tidak ada hasil') + '.');
    return decodeEntities(out);
  },
  async jisho(t, sl, tl) {
    if (!(sl === 'ja' || sl === 'auto') || tl !== 'en') throw new TrError('bad', 'Jisho hanya mendukung Jepang ke Inggris.');
    const r = await httpRequest({ url: 'https://jisho.org/api/v1/search/words?keyword=' + enc(t) });
    trHttpCheck(r, 'Jisho'); const j = trJson(r, 'Jisho'); const d = (j.data || [])[0];
    if (!d || !d.senses || !d.senses.length) throw new TrError('bad', 'Jisho: kata tidak ditemukan.');
    return d.senses.slice(0, 3).map(s => (s.english_definitions || []).slice(0, 3).join(', ')).filter(Boolean).join('; ');
  },
  async libre(t, sl, tl, p) {
    const base = (p.libreUrl || 'https://libretranslate.com').replace(/\/+$/, '').replace(/\/translate$/, '');
    const body = { q: t, source: sl, target: tl, format: 'text' }; if (p.libreKey) body.api_key = p.libreKey;
    const r = await httpRequest({ url: base + '/translate', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    trHttpCheck(r, 'LibreTranslate'); const j = trJson(r, 'LibreTranslate');
    if (!j.translatedText) throw new TrError('bad', 'LibreTranslate: ' + (j.error || 'tidak ada hasil') + '.');
    return j.translatedText;
  },
  async google(t, sl, tl, p) {
    if (!p.googleKey) throw new TrError('auth', 'Isi kunci API Google di pengaturan.');
    const r = await httpRequest({ url: 'https://translation.googleapis.com/language/translate/v2?key=' + enc(p.googleKey) + '&q=' + enc(t) + (sl === 'auto' ? '' : '&source=' + zhMap(sl)) + '&target=' + zhMap(tl) + '&format=text' });
    trHttpCheck(r, 'Google'); const j = trJson(r, 'Google'); const o = j.data && j.data.translations && j.data.translations[0];
    if (!o) throw new TrError('bad', 'Google: tidak ada hasil.'); return decodeEntities(o.translatedText);
  },
  async deepl(t, sl, tl, p) {
    if (!p.deeplKey) throw new TrError('auth', 'Isi kunci API DeepL di pengaturan.');
    const host = /:fx$/.test(p.deeplKey) ? 'api-free.deepl.com' : 'api.deepl.com';
    const tgt = tl === 'en' ? 'EN-US' : tl === 'pt' ? 'PT-BR' : tl.toUpperCase();
    const body = 'text=' + enc(t) + (sl === 'auto' ? '' : '&source_lang=' + sl.toUpperCase()) + '&target_lang=' + tgt;
    const r = await httpRequest({ url: 'https://' + host + '/v2/translate', method: 'POST', headers: { 'Authorization': 'DeepL-Auth-Key ' + p.deeplKey, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    trHttpCheck(r, 'DeepL'); const j = trJson(r, 'DeepL'); const o = j.translations && j.translations[0];
    if (!o) throw new TrError('bad', 'DeepL: tidak ada hasil.'); return o.text;
  }
};

/* ---------- cache ---------- */
let _trc = null;
function trcMap() { if (!_trc) { try { _trc = new Map(JSON.parse(lsGet('ade-trc') || '[]')); } catch (e) { _trc = new Map(); } } return _trc; }
const trCacheSave = debounce(() => { const c = trcMap(); let a = [...c]; if (a.length > 1500) a = a.slice(a.length - 1500); lsSet('ade-trc', JSON.stringify(a)); }, 500);
async function translateText(text, p) {
  const key = [p.provider, p.sl, p.tl, text].join('\u0001'); const c = trcMap();
  if (c.has(key)) return c.get(key);
  if (text.length > 450) throw new TrError('bad', 'Teks terlalu panjang (' + text.length + ' karakter, maksimal 450).');
  let out, tries = 0;
  for (;;) { try { out = await TR_IMPL[p.provider](text, p.sl, p.tl, p); break; } catch (e) { if (e.code === 'net' && ++tries < 2) { await new Promise(r => setTimeout(r, 600)); continue; } throw e; } }
  out = String(out).replace(/\s+/g, ' ').trim(); if (!out) throw new TrError('bad', 'Hasil terjemahan kosong.');
  c.set(key, out); trCacheSave(); return out;
}

/* ---------- teks sumber dan hasil ---------- */
function trSource(html, sl) {
  let s = String(html || '').replace(/\[sound:[^\]]*\]/g, ' ').replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '$1');
  s = stripHtml(s); if (sl === 'ja' || sl === 'auto') s = s.replace(/\[[^\]]*\]/g, '');
  return s.replace(/\s+/g, ' ').trim();
}
function trCompose(cur, tr, mode, sep) {
  const curText = stripHtml(cur || '').trim(); const add = esc(tr);
  if (mode === 'replace') return stripHtml(cur || '').trim() === tr ? null : add;
  if (mode === 'fill') return curText ? null : add;
  if (curText && curText.toLowerCase().includes(tr.toLowerCase())) return null;
  return curText ? cur + sep + add : add;
}

/* ---------- satu field (tombol di editor) ---------- */
async function translateOneField(model, i, getAll, apply) {
  const p = trPrefs(); const all = getAll();
  let si = p.src ? fieldIndex(model, p.src) : 0; if (si < 0 || si === i) si = i === 0 ? 1 : 0;
  if (si >= model.flds.length) { toast('Tipe catatan ini hanya punya satu field.', { kind: 'err' }); return; }
  const text = trSource(all[si], p.sl); if (!text) { toast('Field “' + model.flds[si].name + '” masih kosong.', { kind: 'err' }); return; }
  const done = busy('Menerjemahkan…');
  try {
    const t = await translateText(text, p); const res = trCompose(all[i], t, p.mode === 'fill' ? 'fill' : p.mode === 'replace' ? 'replace' : 'append', p.sep);
    if (res == null) toast('Tidak ada perubahan (sudah terisi atau sudah memuat terjemahan).'); else { apply(res); toast('Diterjemahkan: ' + t); }
  } catch (e) { toast((e && e.message) || String(e), { kind: 'err', ms: 8000 }); }
  finally { done(); }
}

/* ---------- dialog massal ---------- */
function dlgTranslate(o = {}) {
  const p = trPrefs(); let sc = o.scope || (UI.sel.size ? 'sel' : (UI.ids.length !== C.notes.size ? 'filter' : 'all'));
  if (sc === 'sel' && !UI.sel.size) sc = 'all';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sel = (opts, val, id, label) => { const s = h('select', { id, 'aria-label': label }, opts.map(([v, l]) => h('option', { value: v }, l))); s.value = val; return s; };
  const provSel = sel(TR_PROVIDERS, p.provider, 'tr-prov', 'Layanan'); const slSel = sel(TR_LANGS, p.sl, 'tr-sl', 'Bahasa asal'); const tlSel = sel(TR_LANGS.filter(x => x[0] !== 'auto'), p.tl, 'tr-tl', 'Bahasa tujuan');
  const modeSel = sel([['append', 'Tambahkan di belakang isi yang ada'], ['fill', 'Isi hanya jika field kosong'], ['replace', 'Ganti isi field']], p.mode, 'tr-mode', 'Mode'); const sepSel = sel(TR_SEPS, p.sep, 'tr-sep', 'Pemisah');
  const srcSel = h('select', { id: 'tr-src', 'aria-label': 'Field sumber' }); const dstSel = h('select', { id: 'tr-dst', 'aria-label': 'Field tujuan' });
  const info = h('div', { class: 'note' }); const out = h('div', { style: { marginTop: '10px' } });
  const inp = (k, ph, type) => h('input', { type: type || 'text', value: p[k] || '', placeholder: ph, class: 'mono', 'aria-label': ph, onchange: e => { p[k] = e.target.value.trim(); } });
  const setBox = h('div', { class: 'fld' });
  const renderSettings = () => {
    const pv = provSel.value; setBox.textContent = '';
    const rows = { mymemory: [field('Email (opsional, menaikkan kuota harian)', inp('mmEmail', 'nama@email.com'))], jisho: [h('div', { class: 'hint', text: 'Hanya Jepang ke Inggris. Memberi arti kamus. Hanya bisa dari aplikasi desktop atau Android.' })], libre: [field('Alamat server', inp('libreUrl', 'https://libretranslate.com')), field('Kunci API (jika perlu)', inp('libreKey', 'API key', 'password'))], google: [field('Kunci API Google Cloud', inp('googleKey', 'API key', 'password'))], deepl: [field('Kunci API DeepL (akhiran :fx = paket gratis)', inp('deeplKey', 'API key', 'password')), h('div', { class: 'hint', text: 'Hanya bisa dari aplikasi desktop atau Android.' })] }[pv];
    rows.forEach(r => setBox.append(r));
  };
  const pickModel = ids => { const cnt = new Map(); ids.forEach(id => { const n = C.notes.get(id); if (n) cnt.set(n.mid, (cnt.get(n.mid) || 0) + 1); }); let best = null; cnt.forEach((c, m) => { if (!best || c > best[1]) best = [m, c]; }); const model = best ? C.models[String(best[0])] : null; return { model, use: model ? ids.filter(id => (C.notes.get(id) || {}).mid === model.id) : [], other: ids.length - (best ? best[1] : 0) }; };
  const scopeIds = () => sc === 'sel' ? [...UI.sel] : sc === 'filter' ? UI.ids.slice() : [...C.notes.keys()];
  const fillFields = () => {
    const { model } = pickModel(scopeIds()); const names = model ? model.flds.map(f => f.name) : [];
    const keepS = srcSel.value || p.src || names[0], keepD = dstSel.value;
    srcSel.textContent = ''; dstSel.textContent = ''; names.forEach(n => { srcSel.append(h('option', { value: n }, n)); dstSel.append(h('option', { value: n }, n)); });
    if (names.includes(keepS)) srcSel.value = keepS; dstSel.value = names.includes(keepD) ? keepD : (names[1] || names[0] || '');
  };
  const upd = () => {
    const { model, use, other } = pickModel(scopeIds());
    const texts = new Set(); if (model) { const si = fieldIndex(model, srcSel.value); use.forEach(id => { const t = trSource((C.notes.get(id).fields[si] || ''), slSel.value); if (t) texts.add(t); }); }
    info.textContent = use.length + ' catatan' + (model ? ' bertipe “' + model.name + '”' : '') + ', ' + texts.size + ' teks unik untuk diterjemahkan.' + (other ? ' ' + other + ' catatan bertipe lain dilewati.' : '') + ' Teks dikirim ke layanan yang dipilih.';
    sepSel.disabled = modeSel.value !== 'append';
  };
  const scopes = h('div', { class: 'seg' },
    UI.sel.size ? h('label', null, h('input', { type: 'radio', name: 'tr-sc', checked: sc === 'sel' ? true : null, onchange: () => { sc = 'sel'; fillFields(); upd(); } }), 'Terpilih (' + UI.sel.size + ')') : null,
    UI.ids.length !== C.notes.size ? h('label', null, h('input', { type: 'radio', name: 'tr-sc', checked: sc === 'filter' ? true : null, onchange: () => { sc = 'filter'; fillFields(); upd(); } }), 'Hasil filter (' + UI.ids.length + ')') : null,
    h('label', null, h('input', { type: 'radio', name: 'tr-sc', checked: sc === 'all' ? true : null, onchange: () => { sc = 'all'; fillFields(); upd(); } }), 'Semua (' + C.notes.size + ')'));
  provSel.addEventListener('change', renderSettings); [slSel, srcSel, modeSel].forEach(e => e.addEventListener('change', upd));
  fillFields(); renderSettings(); upd();
  let cancel = false; const stopBtn = h('button', { class: 'btn sm', type: 'button', hidden: true, onclick: () => { cancel = true; } }, 'Hentikan'); const prog = h('span', { class: 'muted' });

  const read = () => { Object.assign(p, { provider: provSel.value, sl: slSel.value, tl: tlSel.value, mode: modeSel.value, sep: sepSel.value, src: srcSel.value }); trSave(p); return p; };
  const run = async preview => {
    read(); const ids = scopeIds(); const { model, use } = pickModel(ids); out.textContent = '';
    if (!model || !use.length) { toast('Tidak ada catatan untuk diterjemahkan.', { kind: 'err' }); return false; }
    const si = fieldIndex(model, srcSel.value), di = fieldIndex(model, dstSel.value);
    if (si < 0 || di < 0 || si === di) { toast('Pilih field sumber dan tujuan yang berbeda.', { kind: 'err' }); return false; }
    let skipEmpty = 0, skipFilled = 0; let jobs = [];
    for (const id of use) { const n = C.notes.get(id); const text = trSource(n.fields[si] || '', p.sl); if (!text) { skipEmpty++; continue; } const cur = n.fields[di] || ''; if (p.mode === 'fill' && stripHtml(cur).trim()) { skipFilled++; continue; } jobs.push({ id, text, cur }); }
    if (preview) jobs = jobs.slice(0, 5);
    const uniq = [...new Set(jobs.map(j => j.text))]; if (!uniq.length) { out.append(h('div', { class: 'note warn', text: 'Tidak ada yang perlu diterjemahkan (' + skipEmpty + ' sumber kosong, ' + skipFilled + ' tujuan sudah terisi).' })); return false; }
    const results = new Map(); const errors = []; let abort = null, done = 0; cancel = false; stopBtn.hidden = false;
    const step = async t => {
      try { results.set(t, await translateText(t, p)); } catch (e) { errors.push([t, (e && e.message) || String(e)]); if (e && (e.code === 'quota' || e.code === 'auth')) abort = e; }
      prog.textContent = (++done) + ' / ' + uniq.length; await sleep(p.provider === 'mymemory' ? 150 : 60);
    };
    let k = 0; const worker = async () => { while (k < uniq.length && !cancel && !abort) await step(uniq[k++]); };
    prog.textContent = '0 / ' + uniq.length;
    try { await Promise.all(Array.from({ length: p.provider === 'jisho' ? 1 : 3 }, worker)); } finally { stopBtn.hidden = true; }
    const errBox = () => errors.length ? h('div', { class: 'note err', style: { marginTop: '8px' } }, (abort ? abort.message : errors[0][1]) + (errors.length > 1 ? ' (' + errors.length + ' gagal)' : '')) : null;
    if (preview) {
      const rows = jobs.map(j => h('tr', null, h('td', { class: 'notr', text: j.text }), h('td', { class: 'notr', text: results.has(j.text) ? results.get(j.text) : '—' })));
      out.append(h('table', { class: 'tbl' }, h('tbody', null, rows)), errBox()); return false;
    }
    const changes = []; let same = 0;
    for (const j of jobs) { if (!results.has(j.text)) continue; const res = trCompose(j.cur, results.get(j.text), p.mode, p.sep); if (res == null) same++; else changes.push([j.id, res]); }
    if (!changes.length) { out.append(h('div', { class: 'note warn', text: 'Tidak ada perubahan. ' + same + ' catatan sudah memuat terjemahan atau tidak perlu diubah.' }), errBox()); return false; }
    mutate('Terjemah otomatis', () => { for (const [id, res] of changes) { const n = C.notes.get(id); if (n && setField(n, di, res)) syncCards(n); } }, { editor: true });
    toast(changes.length + ' catatan diterjemahkan' + (errors.length ? ', ' + errors.length + ' gagal.' : '.') + (cancel ? ' (dihentikan)' : ''), { kind: errors.length ? 'err' : '', ms: 7000 });
    return true;
  };
  openModal({
    title: 'Terjemah otomatis', wide: true, body: [
      field('Isi', scopes),
      h('div', { class: 'frow' }, field('Field sumber', srcSel), field('Field tujuan', dstSel)),
      h('div', { class: 'frow' }, field('Bahasa asal', slSel), field('Bahasa tujuan', tlSel)),
      h('div', { class: 'frow' }, field('Mode', modeSel), field('Pemisah', sepSel)),
      field('Layanan', provSel), setBox, info,
      h('div', { class: 'rowflex', style: { marginTop: '8px' } }, prog, stopBtn), out],
    actions: [{ label: 'Tutup' }, { label: 'Pratinjau 5 teks', onClick: async () => { await run(true); return false; } }, { label: 'Terjemahkan', kind: 'primary', id: 'tr-run', onClick: () => run(false) }]
  });
}

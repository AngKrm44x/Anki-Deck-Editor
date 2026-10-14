/* ============ export / import / init ============ */
async function getDownloads() { try { if (window.claude && window.claude.use) return await window.claude.use('downloads'); } catch (e) { } return null; }
let DLCAP = null, DLCAP_DONE = false;
async function dlReady() { if (!DLCAP_DONE) { DLCAP = await getDownloads(); DLCAP_DONE = true; } return DLCAP; }
function manualDownload(filename, blob) {
  const url = URL.createObjectURL(blob); let clicked = false;
  const a = h('a', { class: 'btn primary', href: url, download: filename, style: { display: 'inline-block', textDecoration: 'none', textAlign: 'center' } }, 'Unduh ' + filename);
  a.addEventListener('click', () => { clicked = true; });
  const tab = h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener', style: { display: 'inline-block', textDecoration: 'none', textAlign: 'center' } }, 'Buka di tab baru');
  openModal({ title: 'Simpan file', body: [h('p', null, 'File siap: ' + filename + ' (' + fmtBytes(blob.size) + ').'), h('div', { class: 'rowflex', style: { flexWrap: 'wrap', gap: '8px' } }, a, tab), h('div', { class: 'note', text: 'Klik "Unduh". Jika browser tidak menyimpan (diblokir oleh penampil), pakai "Buka di tab baru", lalu simpan dengan Ctrl+S atau tekan lama / menu titik tiga > Unduh.' })], actions: [{ label: 'Selesai', kind: 'primary', onClick: () => { setTimeout(() => URL.revokeObjectURL(url), 60000); } }] });
  return 'manual';
}
async function saveBlob(filename, data) {
  const dl = await dlReady();
  if (dl) {
    try { const r = await dl.save({ filename, data }); return r.status; }
    catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (!(e && ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed', 'extension_not_enabled', 'rejected_extension'].includes(e.code))) throw new UserError((e && e.message) || 'Gagal menyimpan file.');
      DLCAP = null;
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  if (window.showSaveFilePicker) {
    try {
      const ext = (filename.match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
      const fh = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'File', accept: { 'application/octet-stream': ['.' + ext] } }] });
      const w = await fh.createWritable(); await w.write(blob); await w.close(); return 'saved';
    } catch (e) { if (e && e.name === 'AbortError') return 'declined'; }
  }
  return manualDownload(filename, blob);
}
function busy(msg) { const t = h('div', { class: 'toast', role: 'status' }, msg); $('#toast-root').append(t); return () => t.remove(); }
function notesInDeck(name) { const out = []; for (const n of C.notes.values()) if ((C.byNote.get(n.id) || []).some(c => { const d = deckName(c.did); return d === name || d.startsWith(name + '::'); })) out.push(n.id); return out; }
function exportText(ids, fmt, o) {
  const sep = fmt === 'txt' ? '\t' : fmt === 'csv;' ? ';' : ','; const notes = ids.map(i => C.notes.get(i)).filter(Boolean);
  const maxF = Math.max(1, ...notes.map(n => (C.models[String(n.mid)] || { flds: [0] }).flds.length));
  const rows = []; const firstModel = notes.length ? C.models[String(notes[0].mid)] : null; const single = new Set(notes.map(n => n.mid)).size === 1;
  const hd = [];
  if (fmt !== 'txt' && o.header) { const r = []; if (o.guid) r.push('guid'); if (o.model) r.push('notetype'); if (o.deck) r.push('deck'); for (let i = 0; i < maxF; i++) r.push(single && firstModel && firstModel.flds[i] ? firstModel.flds[i].name : 'Field ' + (i + 1)); if (o.tags) r.push('tags'); rows.push(r); }
  for (const n of notes) {
    const m = C.models[String(n.mid)]; const cs = C.byNote.get(n.id) || []; const r = [];
    if (o.guid) r.push(n.guid); if (o.model) r.push(m ? m.name : ''); if (o.deck) r.push(cs.length ? deckName(cs[0].did) : '');
    for (let i = 0; i < maxF; i++) { let v = n.fields[i] || ''; if (o.strip) v = decodeEntities(String(v).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/\n+$/, ''); r.push(v); }
    if (o.tags) r.push(n.tags.join(' ')); rows.push(r);
  }
  let head = ''; if (fmt === 'txt' && o.header) { let c = 0; head = '#separator:tab\n#html:' + (!o.strip) + '\n'; if (o.guid) head += '#guid column:' + (++c) + '\n'; if (o.model) head += '#notetype column:' + (++c) + '\n'; if (o.deck) head += '#deck column:' + (++c) + '\n'; c += maxF; if (o.tags) head += '#tags column:' + (++c) + '\n'; }
  return head + toDelimited(rows, sep);
}
function exportJson(ids) {
  return JSON.stringify({ koleksi: C.name, dibuat: new Date().toISOString(), notes: ids.map(i => C.notes.get(i)).filter(Boolean).map(n => { const m = C.models[String(n.mid)]; const cs = C.byNote.get(n.id) || []; const f = {}; if (m) m.flds.forEach((x, i) => f[x.name] = n.fields[i] || ''); return { guid: n.guid, notetype: m ? m.name : '', deck: cs.length ? deckName(cs[0].did) : '', tags: n.tags, fields: f }; }) }, null, 2);
}
async function dlgExport(o = {}) {
  await dlReady();
  const st = { fmt: o.fmt || 'apkg', scope: o.scope || (UI.sel.size ? 'sel' : (UI.deck ? 'deck' : 'all')), deck: o.deck || UI.deck || '', o: { deck: true, model: true, tags: true, guid: false, strip: false, header: true } };
  const decks = Object.values(C.decks).map(d => d.name).sort(naturalCmp); if (!st.deck) st.deck = decks.find(n => n !== 'Default') || decks[0];
  const radio = (grp, val, label, checked, onch) => h('label', null, h('input', { type: 'radio', name: grp, value: val, checked: checked ? true : null, onchange: onch }), label);
  const info = h('div', { class: 'note' }); const nameI = h('input', { type: 'text', id: 'ex-name', value: baseName(C.name), 'aria-label': 'Nama file' }); const extL = h('span', { class: 'muted', style: { alignSelf: 'center' } });
  const textOpts = h('div', { class: 'opts' }); const deckWrap = h('div', { class: 'fld' }); const deckSel = h('select', { id: 'ex-deck', 'aria-label': 'Deck' }, decks.map(n => h('option', { value: n }, n))); deckSel.value = st.deck; deckSel.addEventListener('change', () => { st.deck = deckSel.value; upd(); });
  const chk = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.o[k] ? true : null, onchange: e => { st.o[k] = e.target.checked; } }), label);
  textOpts.append(chk('deck', 'Kolom deck'), chk('model', 'Kolom tipe catatan'), chk('tags', 'Kolom tag'), chk('guid', 'Kolom GUID'), chk('strip', 'Buang format HTML (teks polos)'), chk('header', 'Sertakan baris judul / header Anki'));
  const ids = () => st.scope === 'all' ? [...C.notes.keys()] : st.scope === 'filter' ? UI.ids.slice() : st.scope === 'sel' ? [...UI.sel] : notesInDeck(st.deck);
  const ext = () => ({ apkg: DLCAP ? '.zip' : '.apkg', txt: '.txt', csv: '.csv', 'csv;': '.csv', json: '.json' })[st.fmt];
  const upd = () => { const n = ids().length; extL.textContent = ext(); textOpts.hidden = !(st.fmt === 'txt' || st.fmt.startsWith('csv')); deckWrap.hidden = st.scope !== 'deck'; info.className = 'note' + (st.fmt === 'apkg' ? ' warn' : ''); info.textContent = (n + ' catatan akan diekspor. ') + (st.fmt === 'apkg' ? 'Paket .apkg biasa, bisa langsung diimpor ke Anki.' + (DLCAP ? ' Di tampilan claude.ai file disimpan sebagai .zip (ganti ekstensi menjadi .apkg jika Anki menolak).' : '') : (st.fmt === 'txt' ? 'Format teks Anki (dipisah tab) dengan header #. Bisa diimpor lewat File > Import di Anki.' : st.fmt === 'json' ? 'Cadangan terstruktur untuk dibaca program lain.' : 'Cocok dibuka di Excel atau Google Sheets (UTF-8 dengan BOM).')); };
  const fmts = h('div', { class: 'seg' }, [['apkg', 'Paket Anki (.apkg)'], ['txt', 'Teks Anki (.txt)'], ['csv', 'CSV koma'], ['csv;', 'CSV titik koma'], ['json', 'JSON']].map(([v, l]) => radio('ex-fmt', v, l, st.fmt === v, () => { st.fmt = v; upd(); })));
  const scopes = h('div', { class: 'seg' }, radio('ex-scope', 'all', 'Semua (' + C.notes.size + ')', st.scope === 'all', () => { st.scope = 'all'; upd(); }), UI.ids.length !== C.notes.size ? radio('ex-scope', 'filter', 'Hasil filter (' + UI.ids.length + ')', st.scope === 'filter', () => { st.scope = 'filter'; upd(); }) : null, UI.sel.size ? radio('ex-scope', 'sel', 'Terpilih (' + UI.sel.size + ')', st.scope === 'sel', () => { st.scope = 'sel'; upd(); }) : null, radio('ex-scope', 'deck', 'Satu deck', st.scope === 'deck', () => { st.scope = 'deck'; upd(); }));
  upd();
  const run = async () => {
    const idl = ids(); if (!idl.length) { toast('Tidak ada catatan untuk diekspor.', { kind: 'err' }); return false; }
    const fname = (nameI.value.trim() || 'deck').replace(/[\\/:*?"<>|]+/g, '_') + ext(); let data, text = null; const done = busy('Menyiapkan file…');
    try {
      if (st.fmt === 'apkg') { const bytes = await buildApkgBytes(st.scope === 'all' ? C : subsetCollection(idl)); data = new Blob([bytes], { type: 'application/zip' }); }
      else { text = st.fmt === 'json' ? exportJson(idl) : exportText(idl, st.fmt, st.o); data = new Blob([(st.fmt.startsWith('csv') ? '﻿' : '') + text], { type: 'text/plain;charset=utf-8' }); }
    } finally { done(); }
    const status = await saveBlob(fname, data);
    if (status === 'declined') { toast('Penyimpanan dibatalkan.'); return false; }
    if (status === 'manual') return true;
    toast('File dikirim ke penyimpanan: ' + fname + ' (' + fmtBytes(data.size) + ')'); if (st.fmt === 'apkg' && st.scope === 'all') { C.dirty = false; refresh(); }
  };
  openModal({ title: 'Simpan / ekspor', wide: true, body: [field('Format', fmts), field('Isi', scopes, null), (deckWrap.append(field('Deck', deckSel)), deckWrap), h('div', { class: 'fld' }, h('label', { text: 'Nama file' }), h('div', { class: 'rowflex' }, nameI, extL)), textOpts, info], actions: [{ label: 'Batal' }, { label: 'Simpan', kind: 'primary', id: 'ex-save', onClick: run }] });
}
function showTextOut(name, text) {
  const ta = h('textarea', { rows: 14, class: 'mono', readonly: true, 'aria-label': 'Hasil ekspor' }); ta.value = text;
  openModal({ title: name, wide: true, body: [h('div', { class: 'note warn', text: 'Penyimpanan file tidak tersedia di tampilan ini. Salin teks di bawah dan tempel ke file ' + name + '.' }), ta], actions: [{ label: 'Tutup' }, { label: 'Salin', kind: 'primary', onClick: async () => { ta.select(); try { await navigator.clipboard.writeText(text); toast('Tersalin.'); } catch (e) { document.execCommand('copy'); toast('Tersalin.'); } return false; } }] });
}
/* import wizard */
function detectSep(body) { const l = body.split(/\r?\n/).slice(0, 5).join('\n'); const c = { '\t': (l.match(/\t/g) || []).length, ';': (l.match(/;/g) || []).length, ',': (l.match(/,/g) || []).length, '|': (l.match(/\|/g) || []).length }; const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return best[1] ? best[0] : '\t'; }
async function dlgImport(file) {
  const text = await file.text(); const lines = text.split(/\r?\n/); const hdr = {}; let k = 0;
  while (k < lines.length && lines[k].startsWith('#')) { const m = lines[k].match(/^#([^:]+):(.*)$/); if (m) hdr[m[1].trim().toLowerCase()] = m[2].trim(); k++; }
  const bodyText = lines.slice(k).join('\n'); if (!bodyText.trim()) throw new UserError('File ini tidak berisi data.');
  const sepNames = { tab: '\t', comma: ',', semicolon: ';', space: ' ', pipe: '|', colon: ':' };
  const st = { sep: hdr.separator ? (sepNames[hdr.separator.toLowerCase()] || hdr.separator[0]) : detectSep(bodyText), hasHeader: false, html: hdr.html ? hdr.html.toLowerCase() === 'true' : true, mid: null, deck: hdr.deck || ('Impor ' + baseName(file.name)), dup: 'skip', target: (C.kind === 'sample' || !C.notes.size) ? 'new' : 'merge', map: [] };
  const base = C.models[String(C.conf.curModel)] || sortedModels()[0]; const hm = hdr.notetype ? modelByName(hdr.notetype) : null; st.mid = (hm || base).id;
  let rows = parseDelimited(bodyText, st.sep); const ncols = () => Math.max(1, ...rows.slice(0, 200).map(r => r.length));
  const guessHeader = () => { if (hdr.columns || k) return false; const r = rows[0]; if (!r) return false; const m = C.models[String(st.mid)]; const names = new Set(['front', 'back', 'tags', 'tag', 'deck', 'notetype', 'guid', 'question', 'answer', 'text', 'extra', ...(m ? m.flds.map(f => f.name.toLowerCase()) : [])]); return r.some(c => names.has(String(c).trim().toLowerCase())); };
  st.hasHeader = guessHeader();
  const mapping = () => {
    const nc = ncols(); const m = C.models[String(st.mid)]; const map = new Array(nc).fill('skip'); const used = new Set(); const special = new Set();
    const fromH = (key, val) => { if (hdr[key]) { const i = +hdr[key] - 1; if (i >= 0 && i < nc) { map[i] = val; special.add(i); } } };
    fromH('guid column', 'guid'); fromH('notetype column', 'model'); fromH('deck column', 'deck'); fromH('tags column', 'tags');
    if (st.hasHeader && rows[0]) rows[0].forEach((nm, i) => { if (special.has(i)) return; const l = String(nm).trim().toLowerCase(); if (l === 'tags' || l === 'tag') { map[i] = 'tags'; special.add(i); } else if (l === 'deck') { map[i] = 'deck'; special.add(i); } else if (l === 'notetype' || l === 'note type' || l === 'model') { map[i] = 'model'; special.add(i); } else if (l === 'guid') { map[i] = 'guid'; special.add(i); } else { const fi = fieldIndex(m, nm.trim()); if (fi >= 0 && !used.has(fi)) { map[i] = 'f:' + fi; used.add(fi); special.add(i); } } });
    let nf = 0; for (let i = 0; i < nc; i++) { if (special.has(i)) continue; while (used.has(nf)) nf++; if (nf < m.flds.length) { map[i] = 'f:' + nf; used.add(nf); } } return map;
  };
  st.map = mapping();
  const holder = h('div'); let m0;
  const draw = () => {
    holder.textContent = ''; const model = C.models[String(st.mid)]; const data = st.hasHeader ? rows.slice(1) : rows; const nc = ncols();
    const sepSel = h('select', { id: 'im-sep', 'aria-label': 'Pemisah' }, [['\t', 'Tab'], [',', 'Koma'], [';', 'Titik koma'], ['|', 'Garis tegak'], [' ', 'Spasi'], [':', 'Titik dua']].map(([v, l]) => h('option', { value: v }, l))); sepSel.value = st.sep; sepSel.addEventListener('change', () => { st.sep = sepSel.value; rows = parseDelimited(bodyText, st.sep); st.map = mapping(); draw(); });
    const modelSel = h('select', { id: 'im-model', 'aria-label': 'Tipe catatan' }, sortedModels().map(m => h('option', { value: m.id }, m.name))); modelSel.value = String(st.mid); modelSel.addEventListener('change', () => { st.mid = +modelSel.value; st.map = mapping(); draw(); });
    const deckI = h('input', { type: 'text', id: 'im-deck', list: 'decklist', value: st.deck, autocomplete: 'off' }); deckI.addEventListener('input', () => { st.deck = deckI.value; });
    const tgt = h('select', { id: 'im-target', 'aria-label': 'Tujuan' }, h('option', { value: 'new' }, 'Mulai koleksi baru'), h('option', { value: 'merge' }, 'Gabung ke koleksi yang terbuka')); tgt.value = st.target; tgt.addEventListener('change', () => { st.target = tgt.value; });
    const dupS = h('select', { id: 'im-dup', 'aria-label': 'Duplikat' }, h('option', { value: 'skip' }, 'Lewati jika field pertama sudah ada (tipe sama)'), h('option', { value: 'add' }, 'Tambahkan semua')); dupS.value = st.dup; dupS.addEventListener('change', () => { st.dup = dupS.value; });
    const hdrC = h('input', { type: 'checkbox', id: 'im-hdr', checked: st.hasHeader ? true : null }); hdrC.addEventListener('change', () => { st.hasHeader = hdrC.checked; st.map = mapping(); draw(); });
    const htmlC = h('input', { type: 'checkbox', id: 'im-html', checked: st.html ? true : null }); htmlC.addEventListener('change', () => { st.html = htmlC.checked; });
    const opts = [['skip', '(abaikan)'], ...model.flds.map((f, i) => ['f:' + i, 'Field: ' + f.name]), ['tags', 'Tag'], ['deck', 'Deck'], ['model', 'Tipe catatan'], ['guid', 'GUID']];
    const tbl = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { text: 'Kolom' }), h('th', { text: 'Contoh isi' }), h('th', { text: 'Petakan ke' }))));
    const tb = h('tbody'); for (let i = 0; i < nc; i++) { const s = h('select', { 'aria-label': 'Petakan kolom ' + (i + 1) }, opts.map(([v, l]) => h('option', { value: v }, l))); s.value = st.map[i] || 'skip'; s.addEventListener('change', () => { st.map[i] = s.value; }); tb.append(h('tr', null, h('td', { text: String(i + 1) + (st.hasHeader && rows[0] && rows[0][i] ? ' · ' + rows[0][i] : '') }), h('td', { class: 'muted', text: stripHtml((data[0] || [])[i] || '').slice(0, 60) }), h('td', null, s))); } tbl.append(tb);
    holder.append(h('div', { class: 'note', text: file.name + ': ' + data.length + ' baris data, ' + nc + ' kolom.' }), h('div', { class: 'frow' }, field('Pemisah', sepSel), field('Tipe catatan', modelSel), field('Deck tujuan', deckI, 'Dipakai jika tidak ada kolom deck.')), h('div', { class: 'frow' }, field('Tujuan', tgt), field('Duplikat', dupS)),
      h('div', { class: 'opts' }, h('label', { class: 'check' }, hdrC, 'Baris pertama adalah judul kolom'), h('label', { class: 'check' }, htmlC, 'Isi mengandung HTML (jika dimatikan, teks di-escape dan baris baru jadi <br>)')), h('div', { class: 'scrollbox' }, tbl));
  };
  draw();
  const apply = () => {
    const model0 = C.models[String(st.mid)]; const data = st.hasHeader ? rows.slice(1) : rows; if (!data.length) throw new UserError('Tidak ada baris data untuk diimpor.');
    if (!st.map.some(x => x.startsWith('f:'))) throw new UserError('Petakan setidaknya satu kolom ke sebuah field.');
    const prev = C; let pushed = false; const newColl = st.target === 'new';
    try {
      if (newColl) { C = emptyCollection(baseName(file.name)); reindex(); } else { pushUndo('Impor ' + file.name); pushed = true; }
      const model = C.models[String(model0.id)] || modelByName(model0.name) || sortedModels()[0];
      const seen = new Set(); if (st.dup === 'skip') for (const n of C.notes.values()) seen.add(n.mid + '\u0001' + stripHtml(n.fields[0] || ''));
      let added = 0, skipped = 0, empty = 0; const textOf = v => st.html ? v : esc(v).replace(/\r?\n/g, '<br>');
      for (const r of data) {
        let m = model, deck = st.deck, tags = [], guid = null; const f = m.flds.map(() => '');
        st.map.forEach((t, i) => { const v = r[i] == null ? '' : r[i]; if (t === 'tags') tags = v.split(/[\s,]+/).filter(Boolean); else if (t === 'deck') { if (v.trim()) deck = v.trim(); } else if (t === 'model') { const mm = resolveModel(v); if (mm) m = mm; } else if (t === 'guid') guid = v || null; });
        const fl = m.flds.map(() => ''); st.map.forEach((t, i) => { if (t.startsWith('f:')) { const idx = +t.slice(2); if (idx < fl.length) fl[idx] = textOf(r[i] == null ? '' : r[i]); } });
        if (!fl.some(x => stripHtml(x))) { empty++; continue; }
        const key = m.id + '\u0001' + stripHtml(fl[0]); if (st.dup === 'skip') { if (seen.has(key)) { skipped++; continue; } seen.add(key); }
        const note = addNote({ mid: m.id, fields: fl, tags, deck, guid }); if (!(C.byNote.get(note.id) || []).length) { deleteNotes([note.id]); empty++; continue; } added++;
      }
      if (!added) throw new UserError('Tidak ada catatan yang bisa ditambahkan' + (skipped ? ' (semua duplikat)' : '') + '. Periksa pemetaan kolom.');
      if (newColl) { C.kind = 'csv'; C.name = baseName(file.name) + '.apkg'; C.dirty = true; finishLoad(); } else { C.dirty = true; reindex(); refresh({ editor: true }); }
      toast(added + ' catatan diimpor' + (skipped ? ', ' + skipped + ' duplikat dilewati' : '') + (empty ? ', ' + empty + ' baris kosong dilewati' : '') + '.');
    } catch (e) { if (pushed) UNDO.stack.pop(); if (newColl) { C = prev; reindex(); } throw e; }
  };
  m0 = openModal({ title: 'Impor teks / CSV', wide: true, body: holder, actions: [{ label: 'Batal' }, { label: 'Impor', kind: 'primary', id: 'im-go', onClick: async () => { if (st.target === 'new' && !(await discardOk())) return false; try { apply(); } catch (e) { showError(e); return false; } } }] });
}
/* collection lifecycle */
async function discardOk() { if (C && C.dirty && C.kind !== 'sample') return confirmBox('Ada perubahan yang belum disimpan. Tetap lanjut dan buang perubahan itu?', { ok: 'Buang & lanjut', danger: true }); return true; }
function finishLoad() {
  UNDO.stack.length = 0; UNDO.redo.length = 0; UNDO.typingKey = null; ROW.clear(); for (const u of MEDIA_URL.values()) URL.revokeObjectURL(u); MEDIA_URL.clear();
  UI.sel.clear(); UI.anchor = null; UI.deck = UI.tag = UI.model = null; UI.query = ''; $('#q').value = ''; UI.mode = 'edit'; UI.collapsed.clear(); UI.lastModel = null; UI.lastDeck = null; UI.lastEditorKey = null;
  reindex(); refreshNow({ editor: true });
}
function setCollection(c) { C = c; finishLoad(); }
async function openFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['apkg', 'colpkg', 'zip'].includes(ext)) {
    if (!(await discardOk())) return; const done = busy('Membuka ' + file.name + '…');
    try { const c = await openPackage(file); setCollection(c); toast(c.notes.size + ' catatan, ' + c.cards.size + ' kartu, ' + c.media.size + ' file media dimuat.'); } catch (e) { showError(e); } finally { done(); }
  } else if (['csv', 'tsv', 'txt', 'text'].includes(ext)) { try { await dlgImport(file); } catch (e) { showError(e); } }
  else showError(new UserError('Format file tidak dikenali: .' + ext + '. Gunakan .apkg, .colpkg, .zip, .csv, .tsv, atau .txt.'));
}
function dlgNewCollection() {
  const nI = h('input', { type: 'text', id: 'nc-name', value: 'deck-baru', 'data-autofocus': '1' }); const dI = h('input', { type: 'text', id: 'nc-deck', value: 'Deck Baru' });
  openModal({ title: 'Koleksi baru', body: [field('Nama koleksi', nI), field('Deck pertama', dI, 'Boleh bertingkat, misalnya Kanji::第1週.')], actions: [{ label: 'Batal' }, { label: 'Buat', kind: 'primary', onClick: async () => { if (!(await discardOk())) return false; const c = emptyCollection(nI.value.trim() || 'deck-baru'); const prev = C; C = c; try { createDeck(dI.value.trim() || 'Deck Baru'); } finally { C = prev; } c.name = baseName(c.name) + '.apkg'; setCollection(c); C.dirty = false; UI.deck = null; startAdd(); } }] });
}
function sampleCollection() {
  const prev = C; C = emptyCollection('contoh-kanji-N3.apkg'); C.kind = 'sample'; const c = C;
  try {
    const basic = modelByName('Basic'); const cloze = modelByName('Cloze'); const rev = modelByName('Basic (and reversed card)');
    const D = 'Contoh N3 Kanji'; const add = (m, f, t, d) => addNote({ mid: m.id, fields: f, tags: t, deck: d });
    [['駐車', 'ちゅうしゃ - park'], ['駐車場', 'ちゅうしゃじょう - a parking lot'], ['無休', 'むきゅう - working w/o holiday'], ['無料', 'むりょう - free of charge'], ['満車', 'まんしゃ - full (of cars)']].forEach(x => add(basic, x, ['week1', 'parkir'], D + '::第1週::1日目'));
    [['横断歩道', 'おうだんほどう - a pedestrian crossing'], ['押す', 'おす - to push/press'], ['信号', 'しんごう - a signal / a traffic light'], ['確認', 'かくにん - confirmation'], ['飛ぶ', 'とぶ - to fly']].forEach(x => add(basic, x, ['week1', 'jalan'], D + '::第1週::2日目'));
    add(basic, ['危険（な）', 'きけん（な） - danger'], ['week1'], D + '::第1週::3日目'); add(basic, ['階段', 'かいだん - stairs'], ['week1'], D + '::第1週::3日目');
    add(rev, ['空港', 'くうこう - airport'], ['bandara', 'ssw'], 'Contoh SSW Ground Handling'); add(rev, ['手荷物', 'てにもつ - hand luggage'], ['bandara', 'ssw'], 'Contoh SSW Ground Handling');
    add(cloze, ['搭乗券は{{c1::搭乗口}}で見せてください。', 'Tunjukkan boarding pass di pintu keberangkatan.'], ['bandara', 'kalimat'], 'Contoh SSW Ground Handling');
    c.dirty = false;
  } finally { C = prev; }
  return c;
}
/* init */
function init() {
  UI.theme = lsGet('ade-theme') || 'auto'; applyTheme();
  if (typeof initSqlJs === 'undefined' || typeof JSZip === 'undefined') { $('#main-area').hidden = true; $('#fatal').hidden = false; return; }
  initSqlJs().then(S => {
    SQL = S; C = sampleCollection(); reindex(); wire(); refreshNow({ editor: true }); $('#loading').hidden = true;
  }).catch(e => { $('#loading').hidden = true; $('#fatal').hidden = false; $('#fatal-msg').textContent = String(e && e.message || e); });
}
function wire() {
  const openIn = $('#file-open'); $('#btn-open').addEventListener('click', () => { openIn.value = ''; openIn.click(); }); openIn.addEventListener('change', () => { const f = openIn.files[0]; if (f) openFile(f); });
  $('#banner-open').addEventListener('click', () => { openIn.value = ''; openIn.click(); });
  $('#btn-new').addEventListener('click', dlgNewCollection); $('#btn-undo').addEventListener('click', doUndo); $('#btn-redo').addEventListener('click', doRedo);
  $('#btn-find').addEventListener('click', () => dlgFindReplace({ scope: UI.sel.size ? 'sel' : 'filter' })); $('#btn-save').addEventListener('click', () => dlgExport()); $('#btn-help').addEventListener('click', dlgHelp);
  $('#btn-add').addEventListener('click', startAdd); $('#btn-side').addEventListener('click', () => $('.body').classList.toggle('side-open')); $('.scrim').addEventListener('click', () => $('.body').classList.remove('side-open'));
  $('#btn-panel').addEventListener('click', () => { const b = $('.body'); if (UI.mode === 'add' || UI.sel.size) { b.classList.toggle('editor-open'); b.classList.toggle('editor-pinned', b.classList.contains('editor-open')); } else b.classList.toggle('editor-pinned'); b.classList.toggle('editor-open', b.classList.contains('editor-pinned') || UI.sel.size > 0 || UI.mode === 'add'); });
  $('#btn-tools').addEventListener('click', e => openMenu(e.currentTarget, [
    { label: 'Koleksi baru', icon: 'file', onClick: dlgNewCollection }, { label: 'Impor CSV/TXT…', icon: 'file', onClick: () => { openIn.value = ''; openIn.click(); } }, { sep: true },
    { label: 'Cari & ganti', icon: 'replace', onClick: () => dlgFindReplace({ scope: UI.sel.size ? 'sel' : 'filter' }) }, { label: 'Terjemah otomatis…', icon: 'layers', onClick: () => dlgTranslate() }, { label: 'Cari duplikat', icon: 'copy', onClick: dlgDuplicates }, { label: 'Cek kekosongan', icon: 'alert', onClick: dlgEmpty }, { sep: true },
    { label: 'Kelola tag', icon: 'tag', onClick: dlgTags }, { label: 'Tipe catatan', icon: 'file', onClick: () => dlgNoteTypes() }, { label: 'Media', icon: 'image', onClick: dlgMedia }, { sep: true }, { label: 'Statistik', icon: 'stats', onClick: dlgStats }]));
  $('#btn-import').addEventListener('click', () => { openIn.value = ''; openIn.click(); });
  $('#btn-theme').addEventListener('click', () => { UI.theme = ({ auto: 'light', light: 'dark', dark: 'auto' })[UI.theme]; lsSet('ade-theme', UI.theme); applyTheme(); refresh({ editor: true }); toast('Tema: ' + ({ auto: 'otomatis', light: 'terang', dark: 'gelap' })[UI.theme]); });
  const q = $('#q'); const dq = debounce(() => { UI.query = q.value; refresh(); }, 120); q.addEventListener('input', () => { dq(); $('#qclr').hidden = !q.value; }); $('#qclr').addEventListener('click', () => { q.value = ''; UI.query = ''; $('#qclr').hidden = true; refresh(); q.focus(); });
  $('#sort').addEventListener('change', e => { UI.sortKey = e.target.value; refresh(); }); $('#btn-dir').addEventListener('click', () => { UI.sortDir *= -1; refresh(); });
  $('#file-media').addEventListener('change', e => { const f = [...e.target.files]; if (f.length) attachFiles(f); });
  initTable();
  document.addEventListener('keydown', e => {
    const t = e.target; const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); const mod = e.ctrlKey || e.metaKey; if ($('.modal-back')) return;
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); doUndo(); }
    else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !typing) { e.preventDefault(); doRedo(); }
    else if (mod && e.key.toLowerCase() === 'f' && !e.shiftKey) { e.preventDefault(); q.focus(); q.select(); }
    else if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) { e.preventDefault(); startAdd(); }
    else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); dlgExport(); }
  });
  let dragN = 0; addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files') && !UI.drag) { dragN++; document.body.classList.add('dropzone-on'); } });
  addEventListener('dragleave', e => { if (dragN > 0 && --dragN === 0) document.body.classList.remove('dropzone-on'); });
  addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  addEventListener('drop', e => { dragN = 0; document.body.classList.remove('dropzone-on'); if (e.dataTransfer && e.dataTransfer.files.length && !e.defaultPrevented) { e.preventDefault(); openFile(e.dataTransfer.files[0]); } });
  addEventListener('beforeunload', e => { if (C && C.dirty && C.kind !== 'sample') { e.preventDefault(); e.returnValue = ''; } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (UI.theme === 'auto') refresh({ editor: true }); });
  window.__app = { get C() { return C; }, get UI() { return UI; }, buildApkgBytes, exportText, exportJson, openPackage, setCollection, dlgImport, mutate, refreshNow, renderCard, compileSearch, sha1, csumOf, parseDelimited };
}
document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();

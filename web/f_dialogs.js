/* ============ dialogs ============ */
function ids_(sel) { return sel; }
function dlgNewDeck(parent) {
  const inp = h('input', { type: 'text', id: 'nd-name', value: parent ? parent + '::' : '', placeholder: 'Nama::Subdeck', autocomplete: 'off', 'data-autofocus': '1' });
  const go = () => { const v = inp.value.trim(); if (!v) return false; mutate('Deck baru', () => createDeck(v)); UI.deck = v.split('::').map(s => s.trim()).filter(Boolean).join('::'); refresh(); toast('Deck “' + UI.deck + '” dibuat.'); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (go() !== false) $$('.modal-back').pop().remove(); } });
  openModal({ title: parent ? 'Subdeck baru di “' + parent + '”' : 'Deck baru', body: field('Nama deck', inp, 'Pisahkan tingkat dengan “::”, misalnya Kanji N3::第1週::1日目.'), actions: [{ label: 'Batal' }, { label: 'Buat', kind: 'primary', onClick: go }] });
}
function dlgRenameDeck(name) {
  const inp = h('input', { type: 'text', id: 'rd-name', value: name, autocomplete: 'off', 'data-autofocus': '1' });
  openModal({ title: 'Ganti nama / pindahkan deck', body: field('Nama baru', inp, 'Semua subdeck ikut berubah. Ubah awalan untuk memindahkan deck ke induk lain.'), actions: [{ label: 'Batal' }, { label: 'Simpan', kind: 'primary', onClick: () => { const v = inp.value.trim(); try { mutate('Ganti nama deck', () => renameDeck(name, v)); } catch (e) { showError(e); return false; } if (UI.deck && (UI.deck === name || UI.deck.startsWith(name + '::'))) UI.deck = v + UI.deck.slice(name.length); refresh({ editor: true }); } }] });
}
function dlgDeleteDeck(name) {
  const set = Object.values(C.decks).filter(d => d.name === name || d.name.startsWith(name + '::')); const cnt = (C.deckNotes.get(name) || { size: 0 }).size;
  const others = Object.values(C.decks).filter(d => !(d.name === name || d.name.startsWith(name + '::'))).map(d => d.name).sort(naturalCmp);
  let mode = cnt ? 'move' : 'del'; const sel = h('select', { id: 'dd-target', 'aria-label': 'Deck tujuan' }, others.map(n => h('option', { value: n }, n)));
  const body = h('div', { class: 'opts' }, h('p', { text: 'Deck “' + name + '” memiliki ' + cnt + ' catatan' + (set.length > 1 ? ' dan ' + (set.length - 1) + ' subdeck.' : '.') }),
    cnt ? h('label', { class: 'check' }, h('input', { type: 'radio', name: 'dd', checked: true, onchange: () => { mode = 'move'; } }), 'Pindahkan catatan ke deck lain:') : null, cnt ? sel : null,
    cnt ? h('label', { class: 'check' }, h('input', { type: 'radio', name: 'dd', onchange: () => { mode = 'del'; } }), 'Hapus juga semua catatannya') : null);
  openModal({ title: 'Hapus deck', body, actions: [{ label: 'Batal' }, { label: 'Hapus deck', kind: 'danger', onClick: () => { const target = mode === 'move' && others.length ? findDeck(sel.value) : (mode === 'move' ? 1 : null); mutate('Hapus deck', () => deleteDeck(name, mode === 'move' ? target : null)); if (UI.deck && (UI.deck === name || UI.deck.startsWith(name + '::'))) UI.deck = null; refresh({ editor: true }); toast('Deck dihapus.', { action: { label: 'Urungkan', fn: doUndo } }); } }] });
}
function dlgMoveDeck(ids) {
  const inp = h('input', { type: 'text', id: 'mv-name', placeholder: 'Cari atau ketik nama deck baru', autocomplete: 'off', 'data-autofocus': '1' });
  const list = h('div', { class: 'scrollbox minilist' }); const names = Object.values(C.decks).map(d => d.name).sort(naturalCmp);
  let m;
  const apply = n => { n = n.trim(); if (!n) return false; doMove(ids, n); m.close(); };
  const draw = () => { list.textContent = ''; const q = inp.value.trim().toLowerCase(); names.filter(n => !q || n.toLowerCase().includes(q)).slice(0, 200).forEach(n => list.append(h('div', { class: 'tnode', style: { '--d': 0 }, onclick: () => apply(n) }, h('span', { class: 'fi' }, icon('folder', 15)), h('span', { class: 'lbl', text: n })))); };
  inp.addEventListener('input', draw); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const q = inp.value.trim(); const hit = names.find(n => n.toLowerCase() === q.toLowerCase()) || (list.firstElementChild && q === '' ? null : null); apply(hit || q); } }); draw();
  m = openModal({ title: 'Pindahkan ' + ids.length + ' catatan ke deck', body: [inp, list, h('div', { class: 'hint muted', text: 'Enter memakai teks yang diketik. Nama baru akan dibuatkan deck-nya.' })], actions: [{ label: 'Batal' }] });
}
function dlgTagOp(ids, mode) {
  const inp = h('input', { type: 'text', id: 'to-tags', list: 'taglist', placeholder: 'tag1 tag2 …', autocomplete: 'off', 'data-autofocus': '1' }); fillLists();
  const go = () => { const tags = inp.value.split(/[\s,]+/).filter(Boolean); if (!tags.length) return false; mutate(mode === 'add' ? 'Tambah tag' : 'Hapus tag', () => (mode === 'add' ? addTagsTo : removeTagsFrom)(ids, tags)); toast('Tag ' + (mode === 'add' ? 'ditambahkan' : 'dihapus') + ' pada ' + ids.length + ' catatan.'); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (go() !== false) $$('.modal-back').pop().remove(); } });
  openModal({ title: (mode === 'add' ? 'Tambah tag ke ' : 'Hapus tag dari ') + ids.length + ' catatan', body: field('Tag (pisahkan dengan spasi)', inp), actions: [{ label: 'Batal' }, { label: mode === 'add' ? 'Tambah' : 'Hapus', kind: 'primary', onClick: go }] });
}
function dlgTags() {
  const body = h('div'); let m;
  const draw = () => {
    body.textContent = ''; const tags = [...C.tagCounts.entries()].sort((a, b) => naturalCmp(a[0], b[0]));
    if (!tags.length) { body.append(h('div', { class: 'note', text: 'Belum ada tag di koleksi ini.' })); return; }
    const tb = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { text: 'Tag' }), h('th', { class: 'num', text: 'Catatan' }), h('th', { text: '' }))));
    const tbody = h('tbody'); tags.forEach(([t, c]) => {
      const tr = h('tr', null, h('td', { text: t }), h('td', { class: 'num', text: c }), h('td'));
      const td = tr.lastChild; td.style.textAlign = 'right';
      td.append(h('button', { class: 'btn sm', style: { marginRight: '6px' }, onclick: () => { const inp = h('input', { type: 'text', value: t, 'aria-label': 'Nama baru untuk ' + t }); tr.firstChild.textContent = ''; tr.firstChild.append(inp); inp.focus(); inp.select(); td.textContent = ''; const ok = () => { const v = inp.value.trim().replace(/\s+/g, '_'); if (!v || v === t) { draw(); return; } mutate('Ganti nama tag', () => renameTag(t, v)); draw(); toast('Tag diganti. Jika nama sudah ada, tag digabung.'); }; inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); else if (e.key === 'Escape') { e.stopPropagation(); draw(); } }); td.append(h('button', { class: 'btn sm primary', onclick: ok }, 'Simpan')); } }, 'Ganti nama'),
        h('button', { class: 'btn sm danger', onclick: () => { mutate('Hapus tag', () => deleteTag(t)); draw(); } }, 'Hapus'));
      tbody.append(tr);
    });
    tb.append(tbody); body.append(h('div', { class: 'scrollbox' }, tb));
  };
  draw(); m = openModal({ title: 'Kelola tag', body: [body, h('div', { class: 'hint muted', text: 'Mengganti nama tag induk ikut mengganti tag turunannya (a::b). Mengganti ke nama yang sudah ada akan menggabungkan keduanya.' })], actions: [{ label: 'Selesai', kind: 'primary' }] });
}
function dlgFindReplace(o = {}) {
  const scopeSel = h('select', { id: 'fr-scope' }, h('option', { value: 'sel' }, 'Catatan terpilih (' + UI.sel.size + ')'), h('option', { value: 'filter' }, 'Hasil filter saat ini (' + UI.ids.length + ')'), h('option', { value: 'all' }, 'Semua catatan (' + C.notes.size + ')'));
  scopeSel.value = o.scope === 'sel' && UI.sel.size ? 'sel' : (UI.sel.size ? 'sel' : 'filter');
  const names = [...new Set(Object.values(C.models).flatMap(m => m.flds.map(f => f.name)))].sort(naturalCmp);
  const fieldSel = h('select', { id: 'fr-field' }, h('option', { value: '*' }, 'Semua field'), names.map(n => h('option', { value: n }, n)), h('option', { value: '#tags' }, 'Tag'));
  const find = h('input', { type: 'text', id: 'fr-find', autocomplete: 'off', 'data-autofocus': '1' }); const repl = h('input', { type: 'text', id: 'fr-repl', autocomplete: 'off' });
  const rx = h('input', { type: 'checkbox', id: 'fr-rx' }); const cs = h('input', { type: 'checkbox', id: 'fr-cs' });
  const out = h('div', { class: 'note', text: 'Ketik teks yang dicari untuk melihat pratinjau.' });
  const idsFor = () => scopeSel.value === 'sel' ? [...UI.sel] : scopeSel.value === 'filter' ? UI.ids.slice() : [...C.notes.keys()];
  const opts = dry => ({ find: find.value, repl: repl.value, regex: rx.checked, matchCase: cs.checked, field: fieldSel.value, dry });
  const preview = () => {
    if (!find.value) { out.className = 'note'; out.textContent = 'Ketik teks yang dicari untuk melihat pratinjau.'; return null; }
    try { const r = replaceInNotes(idsFor(), opts(true)); out.className = 'note ' + (r.hits ? 'ok' : ''); out.textContent = ''; out.append(h('div', { text: r.hits ? r.hits + ' kecocokan di ' + r.notes + ' catatan.' : 'Tidak ada yang cocok.' }));
      r.samples.slice(0, 5).forEach(([a, b]) => out.append(h('div', { style: { marginTop: '6px', overflowWrap: 'anywhere' } }, h('span', { class: 'diff-old', text: stripHtml(a).slice(0, 80) }), ' → ', h('span', { class: 'diff-new', text: stripHtml(b).slice(0, 80) })))); return r;
    } catch (e) { out.className = 'note err'; out.textContent = 'Pola tidak valid: ' + e.message; return null; }
  };
  const dp = debounce(preview, 150); [find, repl, rx, cs, fieldSel, scopeSel].forEach(e => e.addEventListener('input', dp));
  openModal({
    title: 'Cari & ganti', body: [h('div', { class: 'frow' }, field('Cari', find), field('Ganti dengan', repl)), h('div', { class: 'frow' }, field('Di field', fieldSel), field('Cakupan', scopeSel)),
      h('div', { class: 'opts' }, h('label', { class: 'check' }, rx, 'Ekspresi reguler (gunakan $1, $2 untuk grup)'), h('label', { class: 'check' }, cs, 'Peka huruf besar/kecil')), out],
    actions: [{ label: 'Batal' }, { label: 'Ganti semua', kind: 'primary', onClick: () => { const r = preview(); if (!r || !r.hits) return false; let res; mutate('Cari & ganti', () => { res = replaceInNotes(idsFor(), opts(false)); }, { editor: true }); toast(res.hits + ' penggantian di ' + res.notes + ' catatan.', { action: { label: 'Urungkan', fn: doUndo } }); } }]
  });
}
function dlgChangeType(ids) {
  const mids = new Set(ids.map(i => (C.notes.get(i) || {}).mid)); if (mids.size !== 1) { toast('Pilih catatan dengan tipe yang sama.', { kind: 'err' }); return; }
  const old = C.models[String([...mids][0])]; const others = sortedModels().filter(m => m.id !== old.id);
  if (!others.length) { toast('Belum ada tipe catatan lain. Buat dulu di Alat > Tipe catatan.', { kind: 'err' }); return; }
  const target = h('select', { id: 'ct-model' }, others.map(m => h('option', { value: m.id }, m.name))); const map = h('div', { class: 'opts' });
  const fSels = [], tSels = [];
  const draw = () => {
    const nm = C.models[String(target.value)]; map.textContent = ''; fSels.length = 0; tSels.length = 0;
    map.append(h('div', { class: 'lab', style: { fontWeight: 600, fontSize: '12px', color: 'var(--muted)' }, text: 'Pemetaan field (baru ← lama)' }));
    nm.flds.forEach((f, j) => { const s = h('select', { 'aria-label': 'Sumber untuk ' + f.name }, h('option', { value: '-1' }, '(kosong)'), old.flds.map((o, i) => h('option', { value: i }, o.name))); const guess = old.flds.findIndex(o => o.name.toLowerCase() === f.name.toLowerCase()); s.value = String(guess >= 0 ? guess : (j < old.flds.length ? j : -1)); fSels.push(s); map.append(h('div', { class: 'rowflex' }, h('span', { style: { width: '40%' }, text: f.name }), s)); });
    map.append(h('div', { class: 'lab', style: { fontWeight: 600, fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }, text: 'Pemetaan kartu (lama → baru)' }));
    old.tmpls.forEach((t, i) => { const s = h('select', { 'aria-label': 'Tujuan kartu ' + t.name }, h('option', { value: '-1' }, '(hapus kartu)'), nm.tmpls.map((x, j) => h('option', { value: j }, x.name))); s.value = String(i < nm.tmpls.length ? i : -1); tSels.push(s); map.append(h('div', { class: 'rowflex' }, h('span', { style: { width: '40%' }, text: t.name }), s)); });
  };
  target.addEventListener('change', draw); draw();
  openModal({
    title: 'Ubah tipe ' + ids.length + ' catatan', body: [h('p', { class: 'muted', text: 'Dari “' + old.name + '”.' }), field('Menjadi tipe', target), map, h('div', { class: 'note warn', text: 'Kartu yang dipetakan ke “hapus” akan dihilangkan beserta riwayat belajarnya. Bisa diurungkan dengan Ctrl+Z.' })],
    actions: [{ label: 'Batal' }, { label: 'Ubah', kind: 'primary', onClick: () => { const nm = C.models[String(target.value)]; const fmap = old.flds.map(() => -1); fSels.forEach((s, j) => { const src = +s.value; if (src >= 0 && fmap[src] < 0) fmap[src] = j; }); const tmap = tSels.map(s => +s.value); mutate('Ubah tipe catatan', () => changeNoteType(ids, nm.id, fmap, tmap), { editor: true }); toast('Tipe diubah ke “' + nm.name + '”.'); } }]
  });
}
function dlgDuplicates() {
  const msel = h('select', { id: 'dup-model' }, sortedModels().filter(m => C.modelCounts.get(m.id)).map(m => h('option', { value: m.id }, m.name + ' (' + C.modelCounts.get(m.id) + ')'))); const fsel = h('select', { id: 'dup-field' }); const out = h('div'); let groups = [];
  const fillF = () => { const m = C.models[String(msel.value)]; fsel.textContent = ''; if (m) m.flds.forEach((f, i) => fsel.append(h('option', { value: i }, f.name))); };
  const run = () => {
    const m = C.models[String(msel.value)]; if (!m) { out.textContent = ''; return; } const fi = +fsel.value; const map = new Map();
    for (const n of C.notes.values()) { if (n.mid !== m.id) continue; const k = stripHtml(n.fields[fi] || '').toLowerCase(); if (!k) continue; if (!map.has(k)) map.set(k, []); map.get(k).push(n.id); }
    groups = [...map.entries()].filter(([, a]) => a.length > 1); out.textContent = '';
    if (!groups.length) { out.append(h('div', { class: 'note ok', text: 'Tidak ada duplikat pada field ini.' })); return; }
    const total = groups.reduce((s, [, a]) => s + a.length - 1, 0);
    out.append(h('div', { class: 'note warn', text: groups.length + ' kelompok duplikat, ' + total + ' catatan berlebih.' }));
    const tb = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { text: 'Isi' }), h('th', { class: 'num', text: 'Jumlah' }), h('th', { text: 'Deck' }))));
    const body = h('tbody'); groups.slice(0, 300).forEach(([k, a]) => body.append(h('tr', null, h('td', { text: k.slice(0, 60) }), h('td', { class: 'num', text: a.length }), h('td', { class: 'muted', text: [...new Set(a.map(id => rowFor(C.notes.get(id)).deck))].join(', ').slice(0, 70) })))); tb.append(body);
    out.append(h('div', { class: 'scrollbox', style: { marginTop: '10px' } }, tb));
  };
  msel.addEventListener('change', () => { fillF(); run(); }); fsel.addEventListener('change', run); fillF(); run();
  openModal({
    title: 'Cari duplikat', wide: true, body: [h('div', { class: 'frow' }, field('Tipe catatan', msel), field('Bandingkan field', fsel)), out],
    actions: [{ label: 'Tutup' }, { label: 'Tandai tag “duplikat”', onClick: () => { if (!groups.length) return false; const all = groups.flatMap(([, a]) => a); mutate('Tandai duplikat', () => addTagsTo(all, ['duplikat'])); toast(all.length + ' catatan diberi tag “duplikat”.'); } },
      { label: 'Tampilkan di tabel', onClick: () => { if (!groups.length) return false; UI.query = 'nid:' + groups.flatMap(([, a]) => a).join(','); $('#q').value = UI.query; UI.deck = UI.tag = UI.model = null; refresh(); } },
      { label: 'Hapus duplikat (sisakan yang pertama)', kind: 'danger', onClick: () => { if (!groups.length) return false; const del = groups.flatMap(([, a]) => a.slice(1)); mutate('Hapus duplikat', () => deleteNotes(del)); UI.sel.clear(); refresh({ editor: true }); toast(del.length + ' catatan duplikat dihapus.', { action: { label: 'Urungkan', fn: doUndo } }); } }]
  });
}
function dlgEmpty() {
  const emptyCards = []; for (const n of C.notes.values()) { const m = C.models[String(n.mid)]; if (!m) continue; const need = new Set(neededOrds(n, m)); for (const c of (C.byNote.get(n.id) || [])) if (!need.has(c.ord)) emptyCards.push(c); }
  const noCards = [...C.notes.values()].filter(n => !(C.byNote.get(n.id) || []).length).map(n => n.id);
  const msel = h('select', { id: 'em-model' }, sortedModels().filter(m => C.modelCounts.get(m.id)).map(m => h('option', { value: m.id }, m.name))); const fsel = h('select', { id: 'em-field' }); const res = h('div', { class: 'note' });
  const fillF = () => { const m = C.models[String(msel.value)]; fsel.textContent = ''; if (m) m.flds.forEach((f, i) => fsel.append(h('option', { value: i }, f.name))); };
  let found = []; const run = () => { const m = C.models[String(msel.value)]; const fi = +fsel.value; found = [...C.notes.values()].filter(n => m && n.mid === m.id && !stripHtml(n.fields[fi] || '') && !/<img|\[sound:/.test(n.fields[fi] || '')).map(n => n.id); res.textContent = found.length + ' catatan memiliki field kosong.'; };
  msel.addEventListener('change', () => { fillF(); run(); }); fsel.addEventListener('change', run); fillF(); run();
  openModal({
    title: 'Cek kekosongan', body: [h('h3', { text: 'Kartu kosong', style: { fontSize: '14px' } }), h('div', { class: 'note' + (emptyCards.length ? ' warn' : ' ok'), text: emptyCards.length ? emptyCards.length + ' kartu tidak menghasilkan soal dari isian catatannya.' : 'Tidak ada kartu kosong.' }),
      h('h3', { text: 'Catatan tanpa kartu', style: { fontSize: '14px' } }), h('div', { class: 'note' + (noCards.length ? ' warn' : ' ok'), text: noCards.length ? noCards.length + ' catatan belum punya kartu.' : 'Semua catatan punya kartu.' }),
      h('h3', { text: 'Field kosong', style: { fontSize: '14px' } }), h('div', { class: 'frow' }, field('Tipe', msel), field('Field', fsel)), res],
    actions: [{ label: 'Tutup' }, { label: 'Hapus kartu kosong', kind: 'danger', onClick: () => { if (!emptyCards.length) return false; mutate('Hapus kartu kosong', () => { for (const c of emptyCards) C.cards.delete(c.id); }); toast(emptyCards.length + ' kartu kosong dihapus.'); } },
      { label: 'Buatkan kartu yang kurang', onClick: () => { let k = 0; mutate('Buat kartu', () => { for (const n of C.notes.values()) k += syncCards(n); }); toast(k + ' kartu dibuat.'); } },
      { label: 'Tampilkan field kosong', onClick: () => { if (!found.length) return false; UI.query = 'nid:' + found.join(','); $('#q').value = UI.query; UI.deck = UI.tag = UI.model = null; refresh(); } }]
  });
}
/* note types */
function replaceFieldInTpl(tpl, oldN, newN) { return String(tpl || '').replace(/\{\{([#^\/]?)\s*([^}]+?)\s*\}\}/g, (m, p, body) => { const parts = body.split(':'); const last = parts.pop().trim(); if (last !== oldN) return m; parts.push(newN); return '{{' + p + parts.join(':') + '}}'; }); }
function dlgNoteTypes(startMid) {
  let selMid = startMid || (UI.model != null ? UI.model : sortedModels()[0].id); const left = h('div', { class: 'mlist' }); const right = h('div', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' } }); let curT = 0;
  const touchM = m => { m.mod = sec(); m.usn = -1; m.req = computeReq(m); };
  const drawLeft = () => { left.textContent = ''; sortedModels().forEach(m => left.append(h('button', { class: m.id === selMid ? 'on' : '', onclick: () => { selMid = m.id; curT = 0; draw(); } }, h('span', { text: m.name, style: { overflow: 'hidden', textOverflow: 'ellipsis' } }), h('span', { class: 'muted', text: C.modelCounts.get(m.id) || 0 })))); };
  const draw = () => {
    drawLeft(); right.textContent = ''; const m = C.models[String(selMid)]; if (!m) return; if (curT >= m.tmpls.length) curT = 0; const count = C.modelCounts.get(m.id) || 0;
    const nameI = h('input', { type: 'text', id: 'nt-name', value: m.name, 'aria-label': 'Nama tipe' }); nameI.addEventListener('change', () => { const v = nameI.value.trim(); if (!v || (modelByName(v) && modelByName(v).id !== m.id)) { toast('Nama kosong atau sudah dipakai.', { kind: 'err' }); nameI.value = m.name; return; } mutate('Ganti nama tipe', () => { m.name = v; touchM(m); }); drawLeft(); });
    right.append(h('div', { class: 'frow' }, field('Nama tipe', nameI), field('Jenis', h('input', { type: 'text', disabled: true, value: m.type === 1 ? 'Cloze' : 'Standar' }))));
    /* fields */
    const fl = h('div', { class: 'opts' }); m.flds.forEach((f, i) => {
      const ni = h('input', { type: 'text', value: f.name, 'aria-label': 'Nama field ' + (i + 1), style: { flex: 1 } });
      ni.addEventListener('change', () => { const v = ni.value.trim(); if (!v || m.flds.some((x, j) => j !== i && x.name.toLowerCase() === v.toLowerCase()) || /[:{}"]/.test(v)) { toast('Nama field kosong, ganda, atau memuat karakter terlarang ( : { } " ).', { kind: 'err' }); ni.value = f.name; return; } mutate('Ganti nama field', () => { const o = f.name; f.name = v; m.tmpls.forEach(t => { t.qfmt = replaceFieldInTpl(t.qfmt, o, v); t.afmt = replaceFieldInTpl(t.afmt, o, v); t.bqfmt = replaceFieldInTpl(t.bqfmt, o, v); t.bafmt = replaceFieldInTpl(t.bafmt, o, v); }); touchM(m); }); draw(); });
      const mv = d => { const j = i + d; if (j < 0 || j >= m.flds.length) return; mutate('Pindah field', () => { [m.flds[i], m.flds[j]] = [m.flds[j], m.flds[i]]; m.flds.forEach((x, k) => x.ord = k); if (m.sortf === i) m.sortf = j; else if (m.sortf === j) m.sortf = i; for (const n of C.notes.values()) if (n.mid === m.id) { [n.fields[i], n.fields[j]] = [n.fields[j], n.fields[i]]; touch(n); } touchM(m); }); draw(); };
      fl.append(h('div', { class: 'rowflex' }, ni, h('button', { class: 'btn sm icon', 'aria-label': 'Naik', disabled: i === 0, onclick: () => mv(-1) }, icon('arrowUp', 14)), h('button', { class: 'btn sm icon', 'aria-label': 'Turun', disabled: i === m.flds.length - 1, onclick: () => mv(1) }, icon('arrowDown', 14)),
        h('button', { class: 'btn sm danger icon', 'aria-label': 'Hapus field', disabled: m.flds.length < 2, onclick: () => { mutate('Hapus field', () => { m.flds.splice(i, 1); m.flds.forEach((x, k) => x.ord = k); if (m.sortf === i) m.sortf = 0; else if (m.sortf > i) m.sortf--; for (const n of C.notes.values()) if (n.mid === m.id) { n.fields.splice(i, 1); touch(n); } touchM(m); }); draw(); } }, icon('trash', 14))));
    });
    const addI = h('input', { type: 'text', placeholder: 'Nama field baru', 'aria-label': 'Nama field baru', style: { flex: 1 } });
    const addF = () => { const v = addI.value.trim(); if (!v || m.flds.some(x => x.name.toLowerCase() === v.toLowerCase()) || /[:{}"]/.test(v)) { toast('Nama field kosong, ganda, atau memuat karakter terlarang.', { kind: 'err' }); return; } mutate('Tambah field', () => { m.flds.push(makeField(v, m.flds.length)); for (const n of C.notes.values()) if (n.mid === m.id) { n.fields.push(''); touch(n); } touchM(m); }); draw(); };
    const sortSel = h('select', { id: 'nt-sortf', 'aria-label': 'Field pengurut' }, m.flds.map((f, i) => h('option', { value: i }, f.name))); sortSel.value = String(m.sortf); sortSel.addEventListener('change', () => { mutate('Field pengurut', () => { m.sortf = +sortSel.value; touchM(m); for (const n of C.notes.values()) if (n.mid === m.id) touch(n); }); });
    right.append(h('div', null, h('div', { class: 'lab', style: { fontWeight: 600, fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }, text: 'Field' }), fl, h('div', { class: 'rowflex', style: { marginTop: '8px' } }, addI, h('button', { class: 'btn sm', onclick: addF }, icon('plus', 14), 'Tambah'))), field('Field pengurut (kolom utama di tabel)', sortSel));
    /* templates */
    const t = m.tmpls[curT]; const tsel = h('select', { id: 'nt-tsel', 'aria-label': 'Template' }, m.tmpls.map((x, i) => h('option', { value: i }, x.name))); tsel.value = String(curT); tsel.addEventListener('change', () => { curT = +tsel.value; draw(); });
    const tn = h('input', { type: 'text', id: 'nt-tname', value: t.name, 'aria-label': 'Nama template' }); const q = h('textarea', { id: 'nt-q', rows: 4, class: 'mono', spellcheck: 'false', 'aria-label': 'Template depan' }); q.value = t.qfmt; const a = h('textarea', { id: 'nt-a', rows: 5, class: 'mono', spellcheck: 'false', 'aria-label': 'Template belakang' }); a.value = t.afmt; const css = h('textarea', { id: 'nt-css', rows: 6, class: 'mono', spellcheck: 'false', 'aria-label': 'CSS' }); css.value = m.css;
    const pvHost = h('div', { class: 'pv' }, h('div', { class: 'pv-head' }, icon('eye', 14), h('span', { text: 'Pratinjau dengan catatan pertama' })), h('div', { class: 'pv-body' }));
    const drawPv = () => { const ex = [...C.notes.values()].find(n => n.mid === m.id); const b = pvHost.lastChild; b.textContent = ''; if (!ex) { b.append(h('div', { class: 'note', style: { margin: '10px' }, text: 'Belum ada catatan bertipe ini.' })); return; } const tmp = JSON.parse(JSON.stringify(m)); tmp.tmpls[curT].qfmt = q.value; tmp.tmpls[curT].afmt = a.value; tmp.css = css.value; const save = C.models[String(m.id)]; C.models[String(m.id)] = tmp; try { const host = h('div'); b.append(host); renderPreviewInto(host, ex, Math.min(curT, Math.max(0, (C.byNote.get(ex.id) || []).length - 1)) || curT); } finally { C.models[String(m.id)] = save; } };
    const dpv = debounce(drawPv, 200); [q, a, css].forEach(e => e.addEventListener('input', dpv));
    right.append(h('div', { class: 'frow', style: { alignItems: 'flex-end' } }, field('Template kartu', tsel), field('Nama template', tn), m.type === 0 ? h('div', { class: 'rowflex' }, h('button', { class: 'btn sm', onclick: () => { mutate('Tambah template', () => { m.tmpls.push(makeTmpl('Card ' + (m.tmpls.length + 1), m.tmpls.length, t.qfmt, t.afmt)); touchM(m); for (const n of C.notes.values()) if (n.mid === m.id) syncCards(n); }); curT = m.tmpls.length - 1; draw(); } }, 'Tambah'), h('button', { class: 'btn sm danger', disabled: m.tmpls.length < 2, onclick: async () => { if (!await confirmBox('Hapus template “' + t.name + '” dan semua kartunya?', { danger: true, ok: 'Hapus' })) return; mutate('Hapus template', () => { const o = curT; for (const c of [...C.cards.values()]) { const n = C.notes.get(c.nid); if (!n || n.mid !== m.id) continue; if (c.ord === o) C.cards.delete(c.id); else if (c.ord > o) c.ord--; } m.tmpls.splice(o, 1); m.tmpls.forEach((x, k) => x.ord = k); touchM(m); }); curT = 0; draw(); } }, 'Hapus')) : null),
      field('Depan', q), field('Belakang', a), field('CSS (berlaku untuk semua template tipe ini)', css), pvHost,
      h('div', { class: 'rowflex' }, h('button', { class: 'btn primary', onclick: () => { mutate('Edit template', () => { t.name = tn.value.trim() || t.name; t.qfmt = q.value; t.afmt = a.value; m.css = css.value; touchM(m); for (const n of C.notes.values()) if (n.mid === m.id) { syncCards(n); touch(n); } }); toast('Template disimpan.'); draw(); } }, 'Terapkan template & CSS'), h('span', { class: 'muted', text: 'Menerapkan juga membuat kartu baru bila template sekarang menghasilkannya.' })));
    drawPv();
    right.append(h('div', { class: 'rowflex', style: { flexWrap: 'wrap' } }, h('button', { class: 'btn sm', onclick: () => { let nid; mutate('Gandakan tipe', () => { const c = JSON.parse(JSON.stringify(m)); c.id = newId(); c.name = m.name + ' salinan'; while (modelByName(c.name)) c.name += '*'; c.mod = sec(); C.models[String(c.id)] = c; nid = c.id; }); selMid = nid; draw(); } }, icon('copy', 14), 'Gandakan tipe'),
      h('button', { class: 'btn sm danger', disabled: count > 0 || Object.keys(C.models).length < 2, title: count > 0 ? 'Masih dipakai ' + count + ' catatan' : '', onclick: () => { mutate('Hapus tipe', () => { delete C.models[String(m.id)]; }); selMid = sortedModels()[0].id; draw(); } }, icon('trash', 14), 'Hapus tipe')));
  };
  const addType = h('select', { id: 'nt-add', 'aria-label': 'Tambah tipe baru' }, h('option', { value: '' }, '+ Tipe baru dari…'), ...defaultModels().map((x, i) => h('option', { value: i }, x.name)));
  addType.addEventListener('change', () => { if (addType.value === '') return; const base = defaultModels()[+addType.value]; let nm = base.name; while (modelByName(nm)) nm += '*'; base.name = nm; mutate('Tipe baru', () => { C.models[String(base.id)] = base; }); selMid = base.id; curT = 0; draw(); });
  draw(); openModal({ title: 'Tipe catatan', wide: true, body: h('div', { class: 'split' }, h('div', null, left, h('div', { style: { marginTop: '10px' } }, addType)), right), actions: [{ label: 'Selesai', kind: 'primary' }] });
}
/* media */
function dlgMedia() {
  const body = h('div'); const used = usedMediaSet();
  const draw = () => {
    body.textContent = ''; const used2 = usedMediaSet(); const names = [...C.media.keys()].sort(naturalCmp); const unused = names.filter(n => !used2.has(n));
    const missing = [...used2].filter(r => !/^https?:|^data:|^#/.test(r) && !C.media.has(r)); const total = names.reduce((s, n) => s + C.media.get(n).bytes.length, 0);
    body.append(h('div', { class: 'note', text: names.length + ' file, ' + fmtBytes(total) + '. ' + unused.length + ' tidak dipakai di catatan atau template.' + (missing.length ? ' ' + missing.length + ' rujukan mengarah ke file yang tidak ada.' : '') }));
    if (!names.length) { body.append(h('div', { class: 'empty', text: 'Belum ada file media.' })); return; }
    const grid = h('div', { class: 'mgrid' }); names.slice(0, 400).forEach(n => {
      const k = mediaKind(n); const th = h('div', { class: 'th' }); if (k === 'image') th.append(h('img', { src: mediaUrl(n), alt: n })); else if (k === 'audio') { th.append(h('audio', { controls: true, preload: 'none', src: mediaUrl(n), style: { width: '100%' } })); } else th.append(icon(k === 'video' ? 'file' : 'file', 28));
      grid.append(h('div', { class: 'mitem' }, th, h('div', { class: 'nm', title: n, text: n }), h('div', { class: 'ab' }, h('span', { text: fmtBytes(C.media.get(n).bytes.length) }), used2.has(n) ? h('span', { class: 'tag', text: 'dipakai' }) : h('span', { class: 'tag', style: { color: 'var(--warn)' }, text: 'tidak dipakai' }), h('span', { class: 'spacer-flex' }), h('button', { class: 'btn sm icon ghost', 'aria-label': 'Hapus ' + n, onclick: () => { C.media.delete(n); C.dirty = true; renderTop(); draw(); } }, icon('trash', 14)))));
    }); body.append(grid);
    if (names.length > 400) body.append(h('div', { class: 'muted', text: 'Menampilkan 400 file pertama.' }));
  };
  draw(); const inp = h('input', { type: 'file', multiple: true, hidden: true, onchange: async e => { for (const f of e.target.files) addMediaFile(f.name, new Uint8Array(await f.arrayBuffer())); C.dirty = true; renderTop(); draw(); } });
  openModal({
    title: 'Media', wide: true, body: [body, inp], actions: [{ label: 'Tutup' }, { label: 'Tambah file…', onClick: () => { inp.click(); return false; } },
      { label: 'Hapus yang tidak dipakai', kind: 'danger', onClick: async () => { const u = usedMediaSet(); const rm = [...C.media.keys()].filter(n => !u.has(n)); if (!rm.length) { toast('Tidak ada media yang tidak dipakai.'); return false; } if (!await confirmBox('Hapus ' + rm.length + ' file media yang tidak dipakai? Tindakan ini tidak bisa diurungkan.', { danger: true, ok: 'Hapus' })) return false; rm.forEach(n => C.media.delete(n)); C.dirty = true; renderTop(); draw(); return false; } }]
  });
}
function dlgStats() {
  const cards = [...C.cards.values()]; const st = { baru: cards.filter(c => c.type === 0).length, belajar: cards.filter(c => c.type === 1 || c.type === 3).length, ulas: cards.filter(c => c.type === 2).length, tangguh: cards.filter(c => c.queue === -1).length };
  const row = (a, b) => h('tr', null, h('td', { text: a }), h('td', { class: 'num', text: b }));
  const mt = h('tbody'); sortedModels().forEach(m => mt.append(row(m.name, C.modelCounts.get(m.id) || 0)));
  const top = new Map(); for (const [name, s] of C.deckNotes) if (!name.includes('::')) top.set(name, s.size); const dt = h('tbody'); [...top.entries()].sort((a, b) => naturalCmp(a[0], b[0])).forEach(([n, c]) => dt.append(row(n, c)));
  const empties = [...C.notes.values()].filter(n => n.fields.some(f => !stripHtml(f) && !/<img|\[sound:/.test(f))).length;
  openModal({
    title: 'Statistik koleksi', wide: true, body: h('div', { class: 'frow' }, h('div', { class: 'fld' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { text: 'Ringkasan' }), h('th', { class: 'num', text: '' }))), h('tbody', null, row('Catatan', C.notes.size), row('Kartu', C.cards.size), row('Deck', Object.keys(C.decks).length), row('Tipe catatan', Object.keys(C.models).length), row('Tag', C.tagCounts.size), row('File media', C.media.size), row('Kartu baru', st.baru), row('Kartu dalam belajar', st.belajar), row('Kartu ulasan', st.ulas), row('Kartu ditangguhkan', st.tangguh), row('Catatan dengan field kosong', empties)))),
      h('div', { class: 'fld' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { text: 'Tipe catatan' }), h('th', { class: 'num', text: 'Catatan' }))), mt), h('table', { class: 'tbl', style: { marginTop: '14px' } }, h('thead', null, h('tr', null, h('th', { text: 'Deck tingkat atas' }), h('th', { class: 'num', text: 'Catatan' }))), dt))),
    actions: [{ label: 'Tutup', kind: 'primary' }]
  });
}
function dlgHelp() {
  const k = (a, b) => h('tr', null, h('td', null, h('span', { class: 'kbd', text: a })), h('td', { text: b }));
  openModal({
    title: 'Bantuan', wide: true, body: [
      h('div', { class: 'note', text: 'Semua pemrosesan terjadi di browser kamu. File tidak diunggah ke server mana pun.' }),
      h('h3', { text: 'Pintasan keyboard', style: { fontSize: '14px' } }),
      h('table', { class: 'tbl' }, h('tbody', null, k('Ctrl+Z / Ctrl+Y', 'Urungkan / ulangi'), k('Ctrl+F', 'Fokus ke kotak cari'), k('Ctrl+N', 'Catatan baru'), k('Ctrl+Enter', 'Tambah catatan (di panel catatan baru)'), k('↑ ↓', 'Pindah baris; Shift untuk memperluas pilihan'), k('Ctrl+A', 'Pilih semua baris yang tampil'), k('Delete', 'Hapus catatan terpilih'), k('Ctrl+Shift+C', 'Buat cloze dari teks yang diblok'), k('Esc', 'Tutup dialog / batal pilih'))),
      h('h3', { text: 'Sintaks pencarian', style: { fontSize: '14px' } }),
      h('table', { class: 'tbl' }, h('tbody', null, k('kata', 'catatan yang memuat “kata” di field mana pun'), k('"dua kata"', 'frasa persis'), k('-kata', 'tidak memuat kata'), k('a or b', 'salah satu'), k('deck:Nama', 'deck itu dan subdeck-nya (boleh * wildcard)'), k('tag:week1', 'punya tag; tag:none = tanpa tag'), k('note:Basic', 'tipe catatan'), k('front:*ちゅう*', 'field bernama Front cocok dengan pola'), k('is:suspended', 'new, review, learn, suspended, buried'), k('added:7', 'dibuat 7 hari terakhir'), k('re:^\\d+', 'ekspresi reguler'))),
      h('h3', { text: 'Menyimpan' }, ' '),
      h('div', { class: 'note warn', text: 'Tempat ini hanya mengizinkan unduhan dengan ekstensi tertentu, dan .apkg tidak termasuk. Simpan sebagai .zip (isinya sama persis dengan .apkg). Anki di komputer biasanya bisa mengimpor .zip langsung; kalau tidak, ganti ekstensinya menjadi .apkg.' })], actions: [{ label: 'Tutup', kind: 'primary' }]
  });
}

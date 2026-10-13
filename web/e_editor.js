/* ============ editor ============ */
let _pickCb = null;
function einfo(title, text, ...extra) { return h('div', { class: 'einfo' }, h('h3', { text: title }), h('p', { text }), h('div', { style: { marginTop: '14px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } }, extra)); }
function closeEditorBtn() { return h('button', { class: 'btn icon ghost editor-close', title: 'Tutup panel', 'aria-label': 'Tutup panel', onclick: () => { UI.mode = 'edit'; UI.sel.clear(); $('.body').classList.remove('editor-open', 'editor-pinned'); refresh({ editor: true }); } }, icon('x')); }
function fillLists() {
  let dl = $('#decklist'); if (!dl) { dl = h('datalist', { id: 'decklist' }); document.body.append(dl); }
  dl.textContent = ''; Object.values(C.decks).map(d => d.name).sort(naturalCmp).forEach(n => dl.append(h('option', { value: n })));
  let tl = $('#taglist'); if (!tl) { tl = h('datalist', { id: 'taglist' }); document.body.append(tl); }
  tl.textContent = ''; [...C.tagCounts.keys()].sort(naturalCmp).forEach(n => tl.append(h('option', { value: n })));
}
function taFormat(ta, cmd, val) {
  const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e);
  const wrap = { bold: ['<b>', '</b>'], italic: ['<i>', '</i>'], underline: ['<u>', '</u>'], strikeThrough: ['<s>', '</s>'], superscript: ['<sup>', '</sup>'], subscript: ['<sub>', '</sub>'], insertUnorderedList: ['<ul><li>', '</li></ul>'], insertOrderedList: ['<ol><li>', '</li></ol>'], foreColor: ['<font color="' + val + '">', '</font>'] }[cmd];
  let out; if (cmd === 'removeFormat') out = sel.replace(/<[^>]+>/g, ''); else if (wrap) out = wrap[0] + sel + wrap[1]; else return;
  ta.setRangeText(out, s, e, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true }));
}
function fmt(cmd, val) {
  const el = UI.focused; if (!el || !el.isConnected) { toast('Klik di dalam sebuah field dulu.'); return; }
  el.focus();
  if (el.tagName === 'TEXTAREA') taFormat(el, cmd, val); else { document.execCommand(cmd, false, val); el.dispatchEvent(new Event('input', { bubbles: true })); }
}
function insertAtFocus(html, text) {
  const el = UI.focused; if (!el || !el.isConnected) return false; el.focus();
  if (el.tagName === 'TEXTAREA') { el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); }
  else { document.execCommand('insertHTML', false, html); el.dispatchEvent(new Event('input', { bubbles: true })); }
  return true;
}
async function attachFiles(files) {
  for (const f of files) {
    const name = addMediaFile(f.name || ('media-' + Date.now()), new Uint8Array(await f.arrayBuffer())); C.dirty = true;
    const k = mediaKind(name);
    if (k === 'image') insertAtFocus('<img src="' + esc(name) + '">', '<img src="' + name + '">');
    else if (k === 'audio' || k === 'video') insertAtFocus('[sound:' + esc(name) + ']', '[sound:' + name + ']');
    else toast('Jenis file tidak dikenal: ' + name, { kind: 'err' });
  }
  renderTop();
}
function makeCloze(same, getAll) {
  const el = UI.focused; if (!el || !el.isConnected) { toast('Klik di dalam field teks dulu.'); return; }
  let sel = ''; if (el.tagName === 'TEXTAREA') sel = el.value.slice(el.selectionStart, el.selectionEnd); else sel = String(getSelection());
  if (!sel) { toast('Pilih (blok) teks yang mau dijadikan cloze.'); return; }
  let mx = 0; getAll().forEach(f => { for (const m of String(f).matchAll(/\{\{c(\d+)::/g)) mx = Math.max(mx, +m[1]); });
  const n = same ? Math.max(1, mx) : mx + 1; const txt = '{{c' + n + '::' + sel + '}}';
  el.focus(); if (el.tagName === 'TEXTAREA') { el.setRangeText(txt, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); } else { document.execCommand('insertText', false, txt); }
}
function buildToolbar(model, getAll) {
  const tb = h('div', { class: 'etb', role: 'toolbar', 'aria-label': 'Format teks' });
  const btn = (label, title, fn, extra) => { const b = h('button', Object.assign({ type: 'button', title, 'aria-label': title }, extra || {}), label); b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', fn); return b; };
  tb.append(btn('B', 'Tebal (Ctrl+B)', () => fmt('bold'), { style: { fontWeight: 800 } }), btn('I', 'Miring (Ctrl+I)', () => fmt('italic'), { style: { fontStyle: 'italic' } }), btn('U', 'Garis bawah (Ctrl+U)', () => fmt('underline'), { style: { textDecoration: 'underline' } }),
    btn('S', 'Coret', () => fmt('strikeThrough'), { style: { textDecoration: 'line-through' } }), btn('x²', 'Superskrip', () => fmt('superscript')), btn('x₂', 'Subskrip', () => fmt('subscript')), h('span', { class: 'vsep' }));
  ['#c0392b', '#d97706', '#2f855a', '#2b6cb0', '#7b3fa0', '#1a1a1a'].forEach(c => tb.append(btn('', 'Warna teks ' + c, () => fmt('foreColor', c), { class: 'sw', style: { background: c } })));
  tb.append(h('span', { class: 'vsep' }), btn('•', 'Daftar poin', () => fmt('insertUnorderedList')), btn('1.', 'Daftar angka', () => fmt('insertOrderedList')), btn('Tx', 'Hapus format', () => fmt('removeFormat')), h('span', { class: 'vsep' }));
  tb.append(btn('Gambar', 'Sisipkan gambar', () => pickMedia('image/*')), btn('Audio', 'Sisipkan audio', () => pickMedia('audio/*,video/*')));
  if (model.type === 1) tb.append(h('span', { class: 'vsep' }), btn('[…]', 'Cloze baru (Ctrl+Shift+C)', () => makeCloze(false, getAll)), btn('[…]₌', 'Cloze dengan nomor sama (Ctrl+Alt+Shift+C)', () => makeCloze(true, getAll)));
  return tb;
}
function pickMedia(accept) { const inp = $('#file-media'); inp.accept = accept; inp.value = ''; inp.click(); }
function fieldEditor(model, i, getVal, setVal, getAll) {
  const labelBtn = h('button', { type: 'button', title: 'Tampilkan / sembunyikan sumber HTML', text: 'HTML' });
  const ce = h('div', { class: 'ce', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': model.flds[i].name, spellcheck: 'false' });
  ce.innerHTML = sanitizeHtml(getVal());
  const ta = h('textarea', { class: 'htmlarea', hidden: true, spellcheck: 'false', 'aria-label': model.flds[i].name + ' (HTML)' });
  ce.addEventListener('focus', () => { UI.focused = ce; }); ta.addEventListener('focus', () => { UI.focused = ta; });
  ce.addEventListener('input', () => { let v = ce.innerHTML; if (/^(<br>|<div><br><\/div>)$/.test(v)) v = ''; setVal(v); });
  ta.addEventListener('input', () => setVal(ta.value));
  ce.addEventListener('paste', async e => {
    const files = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (files.length) { e.preventDefault(); UI.focused = ce; attachFiles(files); return; }
    e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t);
  });
  ce.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  ce.addEventListener('drop', e => { const f = [...(e.dataTransfer ? e.dataTransfer.files : [])]; if (f.length) { e.preventDefault(); e.stopPropagation(); UI.focused = ce; attachFiles(f); } });
  ce.addEventListener('keydown', e => { if (e.key === 'C' && e.ctrlKey && e.shiftKey && model.type === 1) { e.preventDefault(); makeCloze(e.altKey, getAll); } });
  labelBtn.addEventListener('click', () => {
    if (ta.hidden) { ta.value = getVal(); ta.hidden = false; ce.hidden = true; ta.focus(); labelBtn.textContent = 'Visual'; }
    else { ce.innerHTML = sanitizeHtml(ta.value); ce.hidden = false; ta.hidden = true; ce.focus(); labelBtn.textContent = 'HTML'; }
  });
  return h('div', { class: 'fld' }, h('div', { class: 'flabel' }, h('span', { text: model.flds[i].name }), labelBtn), ce, ta);
}
function tagEditor(tags, onChange) {
  let cur = tags.slice(); const box = h('div', { class: 'tagbox' });
  const input = h('input', { type: 'text', list: 'taglist', 'aria-label': 'Tambah tag', placeholder: 'tambah tag…', autocomplete: 'off' });
  const commit = () => { const parts = input.value.split(/[\s,]+/).filter(Boolean); input.value = ''; let ch = false; parts.forEach(p => { if (!cur.includes(p)) { cur.push(p); ch = true; } }); if (ch) { draw(); onChange(cur); } };
  input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { if (input.value.trim()) { e.preventDefault(); commit(); box.querySelector('input').focus(); } } else if (e.key === 'Backspace' && !input.value && cur.length) { cur.pop(); draw(); onChange(cur); box.querySelector('input').focus(); } });
  input.addEventListener('change', commit); input.addEventListener('blur', commit);
  function draw() { box.textContent = ''; cur.forEach(t => box.append(h('span', { class: 'tag' }, t, h('button', { type: 'button', 'aria-label': 'Hapus tag ' + t, onclick: () => { cur = cur.filter(x => x !== t); draw(); onChange(cur); } }, icon('x', 11))))); box.append(input); }
  draw(); return box;
}
/* preview */
function renderPreviewInto(host, note, ord) {
  const model = C.models[String(note.mid)]; const root = host.shadowRoot || host.attachShadow({ mode: 'open' }); root.textContent = '';
  let q, a; try { ({ q, a } = renderCard(note, ord)); } catch (e) { root.append(h('div', { style: { padding: '10px', color: '#b3342d' }, text: 'Gagal membuat pratinjau: ' + e.message })); return; }
  const dark = isDark(); const css = String(model.css || '').replace(/<\/style/gi, '');
  const st = h('style'); st.textContent = ':host{display:block}*{box-sizing:border-box}.wrap{padding:0}.card{padding:18px 16px;overflow-wrap:anywhere}.card img{max-width:100%;height:auto}hr.sep{margin:0;border:0;border-top:1px dashed #9aa;}' + css + (dark ? '\n.card{}' : '') + '\n.card{min-height:60px}';
  const wrap = h('div', { class: 'wrap' + (dark ? ' nightMode night_mode' : '') });
  const mk = html => { const d = h('div', { class: 'card' + (dark ? ' nightMode night_mode' : '') }); d.innerHTML = rewriteMedia(sanitizeHtml(html)); return d; };
  wrap.append(mk(q), h('hr', { class: 'sep' }), mk(a)); root.append(st, wrap);
}
function buildPreview(note) {
  const model = C.models[String(note.mid)]; const cs = (C.byNote.get(note.id) || []).slice();
  const host = h('div', { class: 'pv-body' }); const tabs = h('div', { class: 'pv-tabs' }); let cur = cs.length ? cs[0].ord : 0;
  const draw = () => { if (!cs.length) { host.textContent = ''; host.append(h('div', { class: 'note warn', style: { margin: '10px' }, text: 'Catatan ini belum punya kartu. ' + (model && model.type === 1 ? 'Tambahkan {{c1::…}} di salah satu field.' : 'Isi field yang dipakai template.') })); return; } const inner = host.firstElementChild && host.firstElementChild.shadowRoot ? host.firstElementChild : h('div'); if (!inner.parentNode) host.append(inner); renderPreviewInto(inner, note, cur); };
  cs.forEach(c => { const t = model.tmpls[model.type === 1 ? 0 : c.ord]; const b = h('button', { type: 'button', class: c.ord === cur ? 'on' : '', onclick: () => { cur = c.ord; $$('button', tabs).forEach(x => x.classList.toggle('on', x === b)); draw(); } }, model.type === 1 ? 'Cloze ' + (c.ord + 1) : (t ? t.name : 'Kartu ' + (c.ord + 1))); tabs.append(b); });
  const box = h('div', { class: 'pv' }, h('div', { class: 'pv-head' }, icon('eye', 14), h('span', { text: 'Pratinjau kartu' }), h('span', { class: 'sp' }), tabs), host);
  box.redraw = () => { const nc = (C.byNote.get(note.id) || []); if (nc.length !== cs.length) { UI.lastEditorKey = null; refresh({ editor: true }); return; } draw(); };
  draw(); return box;
}
/* main renderer */
function renderEditor() {
  const box = $('#editor'); box.textContent = ''; UI.focused = null; fillLists();
  if (UI.mode === 'add') return renderAddEditor(box);
  if (UI.sel.size === 0) { box.append(h('div', { class: 'ehead' }, h('h2', { text: 'Editor catatan' }), closeEditorBtn()), einfo('Pilih catatan untuk mengedit', 'Klik satu baris di tabel. Tahan Ctrl atau Shift untuk memilih beberapa sekaligus, lalu pakai tombol massal.', h('button', { class: 'btn primary', onclick: startAdd }, icon('plus'), 'Catatan baru'))); return; }
  if (UI.sel.size > 1) {
    const ids = [...UI.sel]; const models = new Set(ids.map(i => (C.notes.get(i) || {}).mid));
    box.append(h('div', { class: 'ehead' }, h('h2', { text: UI.sel.size + ' catatan dipilih' }), closeEditorBtn()), einfo('Edit massal', 'Gunakan tombol di atas tabel: pindah deck, tambah/hapus tag, cari & ganti, tangguhkan, gandakan, ubah tipe, atau hapus.' + (models.size > 1 ? ' Catatan yang dipilih memakai beberapa tipe, jadi “Ubah tipe” tidak tersedia.' : '')));
    return;
  }
  const note = C.notes.get([...UI.sel][0]); if (!note) return; const model = C.models[String(note.mid)];
  if (!model) { box.append(einfo('Tipe catatan hilang', 'Catatan ini merujuk ke tipe yang tidak ada di koleksi.')); return; }
  const getAll = () => note.fields; let pv;
  const sched = debounce(() => pv && pv.redraw && pv.redraw(), 250);
  const body = h('div', { class: 'escroll' });
  const modelSel = h('select', { id: 'ed-model', 'aria-label': 'Tipe catatan', onchange: e => { const nm = +e.target.value; e.target.value = String(note.mid); dlgChangeType([note.id], nm); } }, sortedModels().map(m => h('option', { value: m.id, selected: m.id === note.mid ? true : null }, m.name)));
  const cs = C.byNote.get(note.id) || []; const deckInput = h('input', { type: 'text', id: 'ed-deck', list: 'decklist', value: cs.length ? deckName(cs[0].did) : '', 'aria-label': 'Deck', autocomplete: 'off' });
  const applyDeck = () => { const v = deckInput.value.trim(); if (!v) { deckInput.value = cs.length ? deckName(cs[0].did) : ''; return; } if (cs.length && v === deckName(cs[0].did) && new Set(cs.map(c => c.did)).size === 1) return; doMove([note.id], v); };
  deckInput.addEventListener('change', applyDeck); deckInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyDeck(); } });
  body.append(h('div', { class: 'frow' }, field('Tipe catatan', modelSel), field('Deck', deckInput)), buildToolbar(model, getAll));
  model.flds.forEach((f, i) => body.append(fieldEditor(model, i, () => note.fields[i] || '', v => { mutate('Edit ' + f.name, () => { setField(note, i, v); syncCards(note); }, { typing: 'f' + note.id + ':' + i }); sched(); }, getAll)));
  body.append(field('Tag', tagEditor(note.tags, t => mutate('Ubah tag', () => { note.tags = t.slice(); note.mod = sec(); note.usn = -1; touch(note); }, { typing: 'tg' + note.id }))));
  pv = buildPreview(note); body.append(pv);
  const susp = cs.some(c => c.queue === -1);
  body.append(h('dl', { class: 'meta' }, h('dt', { text: 'Dibuat' }), h('dd', { text: fmtDate(note.id, true) }), h('dt', { text: 'Diubah' }), h('dd', { text: fmtDate(note.mod) }), h('dt', { text: 'Kartu' }), h('dd', { text: cs.length + (susp ? ' (ada yang ditangguhkan)' : '') }), h('dt', { text: 'GUID' }), h('dd', { class: 'mono', text: note.guid }), h('dt', { text: 'ID' }), h('dd', { class: 'mono', text: String(note.id) })));
  box.append(h('div', { class: 'ehead' }, h('h2', { text: 'Edit catatan' }), h('button', { class: 'btn sm', onclick: () => doDuplicate([note.id]) }, icon('copy', 14), 'Gandakan'), h('button', { class: 'btn sm danger', onclick: () => doDelete([note.id]) }, icon('trash', 14), 'Hapus'), closeEditorBtn()), body);
}
function startAdd() {
  const cur = UI.lastModel && C.models[String(UI.lastModel)] ? C.models[String(UI.lastModel)] : (C.models[String(C.conf.curModel)] || sortedModels()[0]);
  const deck = UI.deck || UI.lastDeck || (Object.values(C.decks).find(d => d.id !== 1) || C.decks['1']).name;
  UI.draft = { mid: cur.id, deck, fields: cur.flds.map(() => ''), tags: [] }; UI.mode = 'add'; UI.sel.clear(); refresh({ editor: true });
}
function renderAddEditor(box) {
  const d = UI.draft; const model = C.models[String(d.mid)]; const getAll = () => d.fields;
  const body = h('div', { class: 'escroll' });
  const modelSel = h('select', { id: 'add-model', 'aria-label': 'Tipe catatan', onchange: e => { const old = d.fields; d.mid = +e.target.value; const m = C.models[String(d.mid)]; d.fields = m.flds.map((_, i) => old[i] || ''); UI.lastModel = d.mid; refresh({ editor: true }); } }, sortedModels().map(m => h('option', { value: m.id, selected: m.id === d.mid ? true : null }, m.name)));
  const deckInput = h('input', { type: 'text', id: 'add-deck', list: 'decklist', value: d.deck, 'aria-label': 'Deck', autocomplete: 'off', oninput: e => { d.deck = e.target.value; } });
  body.append(h('div', { class: 'frow' }, field('Tipe catatan', modelSel), field('Deck', deckInput, 'Ketik nama baru (boleh “A::B”) untuk membuat deck.')), buildToolbar(model, getAll));
  const eds = []; model.flds.forEach((f, i) => { const e = fieldEditor(model, i, () => d.fields[i] || '', v => { d.fields[i] = v; }, getAll); eds.push(e); body.append(e); });
  body.append(field('Tag', tagEditor(d.tags, t => { d.tags = t.slice(); })));
  body.append(h('div', { class: 'note', text: 'Ctrl+Enter untuk menambah. Field pertama wajib diisi.' }));
  const add = () => {
    const first = stripHtml(d.fields[0] || '') || /<img|\[sound:/.test(d.fields[0] || '');
    if (!first) { toast('Field pertama masih kosong.', { kind: 'err' }); const f = $('.escroll .ce'); if (f) f.focus(); return; }
    const dup = [...C.notes.values()].some(n => n.mid === d.mid && stripHtml(n.fields[0] || '') === stripHtml(d.fields[0] || ''));
    let made = null; mutate('Tambah catatan', () => { made = addNote({ mid: d.mid, fields: d.fields.slice(), tags: d.tags.slice(), deck: d.deck }); if (!(C.byNote.get(made.id) || []).length) { deleteNotes([made.id]); made = null; } });
    if (!made) { toast(model.type === 1 ? 'Tidak ada cloze di catatan ini, jadi tidak ada kartu yang dibuat.' : 'Template tidak menghasilkan kartu dari isian ini.', { kind: 'err' }); return; }
    UI.lastModel = d.mid; UI.lastDeck = d.deck; d.fields = model.flds.map(() => ''); refresh({ editor: true });
    toast(dup ? 'Ditambahkan. Awas: field pertama sama dengan catatan lain.' : 'Catatan ditambahkan.'); setTimeout(() => { const f = $('.escroll .ce'); if (f) f.focus(); }, 30);
  };
  box.append(h('div', { class: 'ehead' }, h('h2', { text: 'Catatan baru' }), closeEditorBtn()), body, h('div', { class: 'efoot' }, h('button', { class: 'btn primary', onclick: add }, icon('plus'), 'Tambah'), h('button', { class: 'btn', onclick: () => { UI.mode = 'edit'; refresh({ editor: true }); } }, 'Selesai')));
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } });
}

/* ============ UI core ============ */
const UI = {
  sel: new Set(), anchor: null, query: '', deck: null, tag: null, model: null, sortKey: 'id', sortDir: 1,
  collapsed: new Set(), ids: [], mode: 'edit', theme: 'auto', focused: null, tagsAll: false, drag: null, lastEditorKey: null, draft: null, lastModel: null, lastDeck: null
};
const RH = 36;
const SORTS = { id: n => n.id, f1: n => rowFor(n).f1, f2: n => rowFor(n).f2, deck: n => rowFor(n).deck, tags: n => rowFor(n).tagsStr, model: n => rowFor(n).model, mod: n => n.mod };

/* toast / modal / menu */
function toast(msg, o = {}) {
  const t = h('div', { class: 'toast' + (o.kind ? ' ' + o.kind : ''), role: 'status' }, h('span', { text: msg }),
    o.action ? h('button', { class: 'toast-act', onclick: () => { o.action.fn(); t.remove(); } }, o.action.label) : null);
  $('#toast-root').append(t); setTimeout(() => t.remove(), o.ms || 5000);
}
function openModal({ title, body, actions = [], wide = false, onClose }) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  let closed = false;
  const close = () => { if (closed) return; closed = true; document.removeEventListener('keydown', key, true); back.remove(); if (onClose) onClose(); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  const btns = actions.map(a => { const b = h('button', { class: 'btn ' + (a.kind || ''), type: 'button' }, a.label); b.addEventListener('click', async () => { b.disabled = true; let r; try { r = a.onClick ? await a.onClick() : undefined; } catch (e) { b.disabled = false; showError(e); return; } b.disabled = false; if (r !== false && a.close !== false) close(); }); if (a.id) b.id = a.id; return b; });
  box.append(h('div', { class: 'modal-head' }, h('h2', { text: title }), h('button', { class: 'btn icon ghost', type: 'button', title: 'Tutup', 'aria-label': 'Tutup', onclick: close }, icon('x'))),
    h('div', { class: 'modal-body' }, body), actions.length ? h('div', { class: 'modal-foot' }, btns) : null);
  back.append(box); $('#modal-root').append(back);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', key, true);
  setTimeout(() => { const f = box.querySelector('[data-autofocus]') || box.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea') || box.querySelector('.btn.primary'); if (f) f.focus(); }, 0);
  return { close, box };
}
function confirmBox(message, { title = 'Konfirmasi', ok = 'Lanjut', danger = false, detail } = {}) {
  return new Promise(res => {
    let done = false;
    openModal({
      title, body: h('div', null, h('p', { text: message }), detail ? h('p', { class: 'muted', style: { marginTop: '8px' }, text: detail }) : null),
      actions: [{ label: 'Batal', onClick: () => { done = true; res(false); } }, { label: ok, kind: danger ? 'danger' : 'primary', onClick: () => { done = true; res(true); } }],
      onClose: () => { if (!done) res(false); }
    });
  });
}
function showError(e) {
  console.error(e); const msg = e instanceof UserError ? e.message : ('Terjadi kesalahan: ' + (e && e.message ? e.message : e));
  openModal({ title: 'Tidak bisa dilanjutkan', body: h('div', { class: 'note err', text: msg }), actions: [{ label: 'Tutup', kind: 'primary' }] });
}
function openMenu(anchor, items) {
  $$('.menu').forEach(m => m.remove());
  const m = h('div', { class: 'menu', role: 'menu' });
  items.forEach(it => {
    if (it.sep) { m.append(h('hr')); return; }
    const b = h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : '', disabled: it.disabled }, it.icon ? icon(it.icon) : null, h('span', { text: it.label }));
    b.addEventListener('click', () => { close(); it.onClick && it.onClick(); }); m.append(b);
  });
  document.body.append(m);
  const r = anchor.getBoundingClientRect(); const mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - mw - 8)) + 'px';
  m.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + 'px';
  function close() { m.remove(); document.removeEventListener('mousedown', out, true); document.removeEventListener('keydown', esc2, true); }
  const out = e => { if (!m.contains(e.target)) close(); };
  const esc2 = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  setTimeout(() => { document.addEventListener('mousedown', out, true); document.addEventListener('keydown', esc2, true); }, 0);
  const f = m.querySelector('button:not(:disabled)'); if (f) f.focus();
}
function field(label, input, hint) { return h('div', { class: 'fld' }, label ? h('label', { text: label }) : null, input, hint ? h('div', { class: 'hint', text: hint }) : null); }

/* mutate + refresh */
function mutate(label, fn, o = {}) {
  let pushed = false;
  if (o.typing) { const now = Date.now(); if (UNDO.typingKey !== o.typing || now - UNDO.typingAt > 1500) { pushUndo(label); pushed = true; } UNDO.typingKey = o.typing; UNDO.typingAt = now; }
  else { pushUndo(label); pushed = true; UNDO.typingKey = null; }
  let r; try { r = fn(); } catch (e) { if (pushed) UNDO.stack.pop(); throw e; }
  C.dirty = true; reindex(); refresh({ editor: !!o.editor }); return r;
}
let _rq = null, _ropts = {};
function refresh(o = {}) { Object.assign(_ropts, o); if (_rq) return; _rq = requestAnimationFrame(() => { const op = _ropts; _ropts = {}; _rq = null; try { doRefresh(op); } catch (e) { console.error(e); } }); }
function refreshNow(o = {}) { if (_rq) { cancelAnimationFrame(_rq); _rq = null; Object.assign(o, _ropts); _ropts = {}; } doRefresh(o); }
function computeList() {
  let pred = null; try { pred = compileSearch(UI.query); } catch (e) { pred = null; }
  const out = [];
  for (const n of C.notes.values()) {
    if (UI.model != null && n.mid !== UI.model) continue;
    if (UI.tag != null) { if (UI.tag === '\u0000none') { if (n.tags.length) continue; } else if (!n.tags.some(t => t === UI.tag || t.startsWith(UI.tag + '::'))) continue; }
    if (UI.deck != null) { const cs = C.byNote.get(n.id) || []; if (!cs.some(c => { const nm = deckName(c.did); return nm === UI.deck || nm.startsWith(UI.deck + '::'); })) continue; }
    if (pred && !pred(n)) continue;
    out.push(n);
  }
  const kf = SORTS[UI.sortKey] || SORTS.id; const keyed = out.map(n => [kf(n), n.id]);
  if (UI.sortKey === 'id' || UI.sortKey === 'mod') keyed.sort((a, b) => (a[0] - b[0]) * UI.sortDir || a[1] - b[1]);
  else keyed.sort((a, b) => naturalCmp(a[0], b[0]) * UI.sortDir || a[1] - b[1]);
  UI.ids = keyed.map(k => k[1]);
}
function doRefresh(op) {
  for (const id of [...UI.sel]) if (!C.notes.has(id)) UI.sel.delete(id);
  if (UI.anchor != null && !C.notes.has(UI.anchor)) UI.anchor = null;
  if (UI.deck != null && !C.deckNotes.has(UI.deck) && !Object.values(C.decks).some(d => d.name === UI.deck)) UI.deck = null;
  computeList(); renderTop(); renderSide(); renderTable(); renderBulk(); renderChips(); renderStatus();
  const key = editorKey(); if (op.editor || key !== UI.lastEditorKey) { UI.lastEditorKey = key; renderEditor(); }
  const body = $('.body'); body.classList.toggle('editor-open', UI.mode === 'add' || UI.sel.size > 0 || body.classList.contains('editor-pinned'));
}
function editorKey() {
  if (UI.mode === 'add') return 'add:' + (UI.draft ? UI.draft.mid : '');
  if (UI.sel.size === 1) { const id = [...UI.sel][0]; const n = C.notes.get(id); return 'n' + id + ':' + (n ? n.mid + ':' + (C.models[String(n.mid)] ? C.models[String(n.mid)].flds.length : 0) : ''); }
  return 'm' + UI.sel.size;
}

/* top bar */
function renderTop() {
  const nm = $('#docname'); nm.textContent = ''; if (C.dirty) nm.append(h('span', { class: 'dot', title: 'Ada perubahan yang belum disimpan' })); nm.append(h('span', { class: 'n', text: C.name }));
  $('#btn-undo').disabled = !UNDO.stack.length; $('#btn-redo').disabled = !UNDO.redo.length;
  $('#btn-undo').title = UNDO.stack.length ? 'Urungkan: ' + UNDO.stack[UNDO.stack.length - 1].label + ' (Ctrl+Z)' : 'Urungkan (Ctrl+Z)';
  $('#banner').hidden = C.kind !== 'sample';
}

/* sidebar */
function buildDeckTree() {
  const names = new Set();
  for (const d of Object.values(C.decks)) { if (d.name === 'Default' && !(C.deckNotes.get('Default') || { size: 0 }).size && Object.keys(C.decks).length > 1) continue; const p = d.name.split('::'); let acc = ''; for (const x of p) { acc = acc ? acc + '::' + x : x; names.add(acc); } }
  const root = { name: null, children: [] }; const map = new Map([['', root]]);
  [...names].sort(naturalCmp).forEach(full => {
    const i = full.lastIndexOf('::'); const parent = i < 0 ? '' : full.slice(0, i); const node = { name: full, label: i < 0 ? full : full.slice(i + 2), children: [] };
    map.set(full, node); (map.get(parent) || root).children.push(node);
  });
  const sortRec = n => { n.children.sort((a, b) => naturalCmp(a.label, b.label)); n.children.forEach(sortRec); }; sortRec(root);
  return root;
}
function renderSide() {
  const box = $('#side-scroll'); const keep = box.scrollTop; box.textContent = '';
  const total = C.notes.size;
  const all = h('div', { class: 'tnode' + (UI.deck == null && UI.tag == null && UI.model == null ? ' active' : ''), style: { '--d': 0 }, onclick: () => { UI.deck = null; UI.tag = null; UI.model = null; UI.query = ''; $('#q').value = ''; refresh(); } },
    h('span', { class: 'twist leaf' }), icon('layers'), h('span', { class: 'lbl', style: { marginLeft: '6px' }, text: 'Semua catatan' }), h('span', { class: 'cnt', text: total }));
  box.append(all);
  box.append(h('h3', null, 'Deck', h('button', { class: 'btn sm icon ghost', title: 'Deck baru', 'aria-label': 'Deck baru', onclick: () => dlgNewDeck('') }, icon('folderPlus'))));
  const root = buildDeckTree();
  const walk = (node, depth) => {
    for (const ch of node.children) {
      const count = (C.deckNotes.get(ch.name) || { size: 0 }).size; const has = ch.children.length > 0; const col = UI.collapsed.has(ch.name);
      const row = h('div', { class: 'tnode' + (UI.deck === ch.name ? ' active' : ''), style: { '--d': depth }, 'data-deck': ch.name, title: ch.name, onclick: () => { UI.deck = UI.deck === ch.name ? null : ch.name; UI.tag = null; UI.model = null; refresh(); $('.body').classList.remove('side-open'); } },
        h('button', { class: 'twist' + (has ? '' : ' leaf'), 'aria-label': col ? 'Buka' : 'Tutup', tabindex: has ? 0 : -1, onclick: e => { e.stopPropagation(); if (col) UI.collapsed.delete(ch.name); else UI.collapsed.add(ch.name); refresh(); } }, icon(col ? 'chevR' : 'chevD', 14)),
        h('span', { class: 'fi' }, icon('folder', 15)), h('span', { class: 'lbl', text: ch.label }), h('span', { class: 'cnt', text: count }),
        h('button', { class: 'more', 'aria-label': 'Menu deck ' + ch.label, onclick: e => { e.stopPropagation(); deckMenu(e.currentTarget, ch.name); } }, icon('more')));
      row.addEventListener('dragover', e => { if (UI.drag) { e.preventDefault(); row.classList.add('drop'); } });
      row.addEventListener('dragleave', () => row.classList.remove('drop'));
      row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('drop'); if (UI.drag) { const ids = UI.drag; UI.drag = null; doMove(ids, ch.name); } });
      box.append(row); if (has && !col) walk(ch, depth + 1);
    }
  };
  walk(root, 0);
  /* note types */
  box.append(h('h3', null, 'Tipe catatan'));
  for (const m of sortedModels()) {
    const cnt = C.modelCounts.get(m.id) || 0;
    box.append(h('div', { class: 'tnode' + (UI.model === m.id ? ' active' : ''), style: { '--d': 0 }, onclick: () => { UI.model = UI.model === m.id ? null : m.id; refresh(); } }, h('span', { class: 'twist leaf' }), h('span', { class: 'fi' }, icon('file', 15)), h('span', { class: 'lbl', text: m.name, title: m.name }), h('span', { class: 'cnt', text: cnt })));
  }
  /* tags */
  const tags = [...C.tagCounts.entries()].sort((a, b) => naturalCmp(a[0], b[0]));
  box.append(h('h3', null, 'Tag', h('button', { class: 'btn sm icon ghost', title: 'Kelola tag', 'aria-label': 'Kelola tag', onclick: dlgTags }, icon('pencil'))));
  const untagged = [...C.notes.values()].filter(n => !n.tags.length).length;
  if (untagged && tags.length) box.append(h('div', { class: 'tnode' + (UI.tag === '\u0000none' ? ' active' : ''), style: { '--d': 0 }, onclick: () => { UI.tag = UI.tag === '\u0000none' ? null : '\u0000none'; refresh(); } }, h('span', { class: 'twist leaf' }), h('span', { class: 'fi' }, icon('tag', 15)), h('span', { class: 'lbl muted', text: '(tanpa tag)' }), h('span', { class: 'cnt', text: untagged })));
  const lim = UI.tagsAll ? tags.length : 40;
  for (const [t, c] of tags.slice(0, lim)) box.append(h('div', { class: 'tnode' + (UI.tag === t ? ' active' : ''), style: { '--d': 0 }, title: t, onclick: () => { UI.tag = UI.tag === t ? null : t; refresh(); } }, h('span', { class: 'twist leaf' }), h('span', { class: 'fi' }, icon('tag', 15)), h('span', { class: 'lbl', text: t }), h('span', { class: 'cnt', text: c })));
  if (tags.length > lim) box.append(h('button', { class: 'btn sm ghost', style: { margin: '6px 8px' }, onclick: () => { UI.tagsAll = true; refresh(); } }, 'Tampilkan ' + (tags.length - lim) + ' tag lagi'));
  if (!tags.length) box.append(h('div', { class: 'muted', style: { padding: '4px 10px', fontSize: '12.5px' }, text: 'Belum ada tag.' }));
  box.scrollTop = keep;
}
function deckMenu(anchor, name) {
  const isDefault = findDeck(name) === 1;
  openMenu(anchor, [
    { label: 'Buat subdeck', icon: 'folderPlus', onClick: () => dlgNewDeck(name) },
    { label: 'Ganti nama / pindahkan', icon: 'pencil', onClick: () => dlgRenameDeck(name), disabled: isDefault },
    { label: 'Ekspor deck ini', icon: 'download', onClick: () => dlgExport({ scope: 'deck', deck: name }) },
    { sep: true },
    { label: 'Hapus deck…', icon: 'trash', danger: true, onClick: () => dlgDeleteDeck(name), disabled: isDefault }
  ]);
}
function renderChips() {
  const box = $('#chips'); box.textContent = '';
  const chip = (txt, fn) => box.append(h('span', { class: 'chip' }, h('span', { text: txt }), h('button', { 'aria-label': 'Hapus filter ' + txt, onclick: fn }, icon('x', 12))));
  if (UI.deck != null) chip('Deck: ' + UI.deck, () => { UI.deck = null; refresh(); });
  if (UI.tag != null) chip('Tag: ' + (UI.tag === '\u0000none' ? '(tanpa tag)' : UI.tag), () => { UI.tag = null; refresh(); });
  if (UI.model != null) chip('Tipe: ' + ((C.models[String(UI.model)] || {}).name || '?'), () => { UI.model = null; refresh(); });
}

/* table */
function renderTable() {
  const sc = $('#tbody'); const space = $('#tspace'); const total = UI.ids.length;
  space.style.height = total * RH + 'px'; $('#empty').hidden = total > 0;
  if (!total) { const e = $('#empty'); e.textContent = ''; const filt = UI.query || UI.deck != null || UI.tag != null || UI.model != null; e.append(h('h3', { text: filt ? 'Tidak ada catatan yang cocok' : 'Koleksi ini masih kosong' }), h('p', { text: filt ? 'Ubah kata kunci atau hapus filter di atas.' : 'Tambahkan catatan dengan tombol “Catatan baru”, atau buka file .apkg / impor CSV.' })); }
  paintRows();
  $$('.thead button[data-sort]').forEach(b => { const on = b.dataset.sort === UI.sortKey; b.setAttribute('aria-sort', on ? (UI.sortDir > 0 ? 'ascending' : 'descending') : 'none'); const a = b.querySelector('.arr'); a.textContent = on ? (UI.sortDir > 0 ? '▲' : '▼') : ''; });
  const cb = $('#chk-all'); cb.checked = total > 0 && UI.ids.every(id => UI.sel.has(id)); cb.indeterminate = !cb.checked && UI.ids.some(id => UI.sel.has(id));
}
function paintRows() {
  const sc = $('#tbody'); const space = $('#tspace'); const total = UI.ids.length;
  const first = Math.max(0, Math.floor(sc.scrollTop / RH) - 6); const last = Math.min(total, Math.ceil((sc.scrollTop + (sc.clientHeight || 600)) / RH) + 6);
  const frag = document.createDocumentFragment();
  for (let i = first; i < last; i++) {
    const n = C.notes.get(UI.ids[i]); if (!n) continue; const r = rowFor(n); const sel = UI.sel.has(n.id);
    const tags = n.tags.slice(0, 3).map(t => h('span', { class: 'tag', text: t })); if (n.tags.length > 3) tags.push(h('span', { class: 'tag more', text: '+' + (n.tags.length - 3) }));
    const row = h('div', { class: 'trow' + (sel ? ' sel' : '') + (UI.sel.size === 1 && sel ? ' active' : ''), role: 'row', 'aria-selected': sel ? 'true' : 'false', 'data-i': i, draggable: 'true', style: { top: i * RH + 'px' } },
      h('span', { class: 'cbx' }, h('input', { type: 'checkbox', tabindex: -1, checked: sel ? true : null, 'aria-label': 'Pilih catatan' })),
      h('span', { class: 'c1', text: r.f1 || '(kosong)', style: r.f1 ? null : { color: 'var(--faint)' } }, r.susp ? h('span', { class: 'badge', text: 'ditangguhkan' }) : null),
      h('span', { class: 'c2', text: r.f2 }),
      h('span', { class: 'cd hide-sm', title: r.decks.join('\n') }, h('bdi', { text: r.deck.split('::').slice(-2).join(' › ') + (r.decks.length > 1 ? '  +' + (r.decks.length - 1) : '') })),
      h('span', { class: 'ct hide-sm' }, tags), h('span', { class: 'cm hide-sm', text: r.model }));
    frag.append(row);
  }
  space.textContent = ''; space.append(frag);
}
function selectRow(idx, ev) {
  const id = UI.ids[idx]; if (id == null) return;
  if (ev.shiftKey && UI.anchor != null && UI.ids.includes(UI.anchor)) {
    const a = UI.ids.indexOf(UI.anchor); const lo = Math.min(a, idx), hi = Math.max(a, idx);
    if (!(ev.ctrlKey || ev.metaKey)) UI.sel.clear(); for (let i = lo; i <= hi; i++) UI.sel.add(UI.ids[i]);
  } else if (ev.ctrlKey || ev.metaKey || (ev.target && ev.target.closest && ev.target.closest('.cbx'))) {
    if (UI.sel.has(id)) UI.sel.delete(id); else UI.sel.add(id); UI.anchor = id;
  } else { UI.sel = new Set([id]); UI.anchor = id; }
  UI.mode = 'edit'; refresh();
}
function ensureVisible(idx) { const sc = $('#tbody'); const top = idx * RH; if (top < sc.scrollTop) sc.scrollTop = top; else if (top + RH > sc.scrollTop + sc.clientHeight) sc.scrollTop = top + RH - sc.clientHeight; }
function initTable() {
  const sc = $('#tbody');
  sc.addEventListener('scroll', () => paintRows(), { passive: true });
  new ResizeObserver(() => paintRows()).observe(sc);
  sc.addEventListener('click', e => { const row = e.target.closest('.trow'); if (!row) return; selectRow(+row.dataset.i, e); });
  sc.addEventListener('dragstart', e => {
    const row = e.target.closest('.trow'); if (!row) return; const id = UI.ids[+row.dataset.i];
    if (!UI.sel.has(id)) { UI.sel = new Set([id]); UI.anchor = id; refresh(); }
    UI.drag = [...UI.sel]; e.dataTransfer.setData('text/plain', UI.drag.length + ' catatan'); e.dataTransfer.effectAllowed = 'move';
  });
  sc.addEventListener('dragend', () => { UI.drag = null; $$('.tnode.drop').forEach(x => x.classList.remove('drop')); });
  sc.addEventListener('keydown', e => {
    const cur = UI.sel.size ? UI.ids.indexOf(UI.anchor != null ? UI.anchor : [...UI.sel][0]) : -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); const ni = Math.max(0, Math.min(UI.ids.length - 1, (cur < 0 ? (e.key === 'ArrowDown' ? -1 : UI.ids.length) : cur) + (e.key === 'ArrowDown' ? 1 : -1)));
      if (e.shiftKey && cur >= 0) { UI.sel.add(UI.ids[ni]); UI.anchor = UI.ids[ni]; } else { UI.sel = new Set([UI.ids[ni]]); UI.anchor = UI.ids[ni]; }
      ensureVisible(ni); refresh();
    } else if (e.key === ' ' && cur >= 0) { e.preventDefault(); const id = UI.ids[cur]; if (UI.sel.has(id)) UI.sel.delete(id); else UI.sel.add(id); refresh(); }
    else if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); UI.sel = new Set(UI.ids); refresh(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (UI.sel.size) { e.preventDefault(); doDelete([...UI.sel]); } }
    else if (e.key === 'Enter' && UI.sel.size === 1) { const f = $('.escroll .ce, .escroll textarea'); if (f) f.focus(); }
    else if (e.key === 'Escape') { UI.sel.clear(); refresh(); }
  });
  $('#chk-all').addEventListener('change', e => { if (e.target.checked) UI.sel = new Set(UI.ids); else UI.sel.clear(); UI.mode = 'edit'; refresh(); });
  $$('.thead button[data-sort]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.sort; if (UI.sortKey === k) UI.sortDir *= -1; else { UI.sortKey = k; UI.sortDir = 1; } $('#sort').value = UI.sortKey; refresh(); }));
}

/* bulk bar + status */
function renderBulk() {
  const b = $('#bulk'); const n = UI.sel.size; b.hidden = n === 0; if (!n) return;
  b.textContent = '';
  const ids = () => [...UI.sel];
  const btn = (label, ic, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, icon(ic, 14), label);
  b.append(h('b', { text: n + ' dipilih' }),
    btn('Pindah deck', 'folder', () => dlgMoveDeck(ids())), btn('Tambah tag', 'tag', () => dlgTagOp(ids(), 'add')), btn('Hapus tag', 'tag', () => dlgTagOp(ids(), 'remove')),
    btn('Cari & ganti', 'replace', () => dlgFindReplace({ scope: 'sel' })), btn('Tangguhkan', 'pause', () => doSuspend(ids(), true)), btn('Aktifkan', 'check', () => doSuspend(ids(), false)),
    btn('Gandakan', 'copy', () => doDuplicate(ids())), btn('Ubah tipe', 'file', () => dlgChangeType(ids())),
    btn('Hapus', 'trash', () => doDelete(ids()), 'danger'), h('span', { class: 'spacer-flex' }), btn('Batal pilih', 'x', () => { UI.sel.clear(); refresh(); }, 'ghost'));
}
function renderStatus() {
  const s = $('#status'); s.textContent = '';
  s.append(h('span', null, h('b', { text: UI.ids.length }), ' dari ', h('b', { text: C.notes.size }), ' catatan'), h('span', null, h('b', { text: C.cards.size }), ' kartu'));
  if (UI.sel.size) s.append(h('span', null, h('b', { text: UI.sel.size }), ' dipilih'));
  s.append(h('span', { class: 'spacer-flex' }), h('span', { class: 'muted', text: C.dirty ? 'Ada perubahan yang belum disimpan' : 'Tersimpan / belum diubah' }));
}

/* actions */
function doMove(ids, deck) {
  const did = findDeck(deck) != null ? findDeck(deck) : null;
  mutate('Pindah ke ' + deck, () => { const id = did != null ? did : deckIdByName(deck); moveNotes(ids, id); });
  toast(ids.length + ' catatan dipindah ke “' + deck + '”.', { action: { label: 'Urungkan', fn: doUndo } });
}
function doDelete(ids) {
  const keep = ids.slice();
  mutate('Hapus catatan', () => deleteNotes(keep)); UI.sel.clear(); refresh({ editor: true });
  toast(keep.length + ' catatan dihapus.', { action: { label: 'Urungkan', fn: doUndo } });
}
function doSuspend(ids, on) { mutate(on ? 'Tangguhkan' : 'Aktifkan', () => setSuspended(ids, on)); toast(ids.length + ' catatan ' + (on ? 'ditangguhkan' : 'diaktifkan') + '.'); }
function doDuplicate(ids) { let nn = []; mutate('Gandakan', () => { nn = duplicateNotes(ids); }); UI.sel = new Set(nn); UI.anchor = nn[0]; refresh({ editor: true }); toast(nn.length + ' catatan digandakan.'); }
function doUndo() { const l = undo(); if (l == null) return; refresh({ editor: true }); toast('Diurungkan: ' + l); }
function doRedo() { const l = redo(); if (l == null) return; refresh({ editor: true }); toast('Diulang: ' + l); }

/* theme */
function applyTheme() { const r = document.documentElement; if (UI.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', UI.theme); const b = $('#btn-theme'); if (b) { b.textContent = ''; b.append(icon(UI.theme === 'dark' ? 'moon' : 'sun')); b.title = 'Tema: ' + ({ auto: 'otomatis', light: 'terang', dark: 'gelap' })[UI.theme]; } }
function isDark() { const t = document.documentElement.getAttribute('data-theme'); return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); }

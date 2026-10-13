/* ============ collection model ============ */
let SQL = null;
let C = null;               // current collection
const ROW = new Map();      // derived display rows
const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn); CREATE INDEX ix_cards_usn on cards (usn); CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid); CREATE INDEX ix_cards_sched on cards (did, queue, due); CREATE INDEX ix_revlog_cid on revlog (cid); CREATE INDEX ix_notes_csum on notes (csum);`;
const LATEX_PRE = '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n';
const CSS_BASIC = '.card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}\n';
const CSS_CLOZE = CSS_BASIC + '\n.cloze {\n font-weight: bold;\n color: blue;\n}\n.nightMode .cloze {\n color: lightblue;\n}\n';

function makeField(name, ord) { return { name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] }; }
function makeTmpl(name, ord, q, a) { return { name, ord, qfmt: q, afmt: a, bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 }; }
function makeModel(name, type, fields, tmpls, css) {
  const m = {
    id: newId(), name, type, mod: sec(), usn: -1, sortf: 0, did: null,
    tmpls: tmpls.map((t, i) => makeTmpl(t[0], i, t[1], t[2])), flds: fields.map((f, i) => makeField(f, i)),
    css, latexPre: LATEX_PRE, latexPost: '\\end{document}', latexsvg: false, req: [], tags: [], vers: []
  };
  m.req = computeReq(m); return m;
}
function tplFieldNames(tpl) {
  const out = []; String(tpl || '').replace(/\{\{([#^\/]?)\s*([^}]+?)\s*\}\}/g, (m, p, body) => { out.push(body.split(':').pop().trim()); return m; }); return out;
}
function computeReq(m) {
  if (m.type === 1) { const i = m.flds.findIndex(f => tplFieldNames(m.tmpls[0] && m.tmpls[0].qfmt).includes(f.name) && /cloze:/.test(m.tmpls[0].qfmt)); return [[0, 'all', [Math.max(0, i)]]]; }
  return m.tmpls.map((t, ord) => {
    const names = tplFieldNames(t.qfmt); const ords = m.flds.filter(f => names.includes(f.name)).map(f => f.ord);
    return ords.length ? [ord, 'any', ords] : [ord, 'none', []];
  });
}
function defaultModels() {
  const bq = '{{Front}}', ba = '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}';
  return [
    makeModel('Basic', 0, ['Front', 'Back'], [['Card 1', bq, ba]], CSS_BASIC),
    makeModel('Basic (and reversed card)', 0, ['Front', 'Back'], [['Card 1', bq, ba], ['Card 2', '{{Back}}', '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}']], CSS_BASIC),
    makeModel('Basic (optional reversed card)', 0, ['Front', 'Back', 'Add Reverse'], [['Card 1', bq, ba], ['Card 2', '{{#Add Reverse}}{{Back}}{{/Add Reverse}}', '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}']], CSS_BASIC),
    makeModel('Basic (type in the answer)', 0, ['Front', 'Back'], [['Card 1', '{{Front}}\n\n{{type:Back}}', '{{Front}}\n\n<hr id=answer>\n\n{{type:Back}}']], CSS_BASIC),
    makeModel('Cloze', 1, ['Text', 'Extra'], [['Cloze', '{{cloze:Text}}', '{{cloze:Text}}<br>\n{{Extra}}']], CSS_CLOZE)
  ];
}
function defaultDconf() {
  return {
    id: 1, mod: 0, name: 'Default', usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true,
    new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
    lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
    rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 }
  };
}
function makeDeckObj(name, id) {
  return {
    id: id || newId(), name, desc: '', mod: sec(), usn: -1, collapsed: false, browserCollapsed: false, dyn: 0, conf: 1,
    extendNew: 10, extendRev: 50, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0]
  };
}
function emptyCollection(name) {
  const now = Date.now();
  const c = {
    name: name || 'koleksi-baru', kind: 'new', dbBytes: null, dbName: 'collection.anki2', extras: {},
    meta: { id: 1, crt: Math.floor(sec() / 86400) * 86400, mod: now, scm: now, ver: 11, dty: 0, usn: 0, ls: 0 },
    conf: {}, decks: { '1': makeDeckObj('Default', 1) }, models: {}, dconf: { '1': defaultDconf() },
    notes: new Map(), cards: new Map(), media: new Map(), nextPos: 1, dirty: false, origModelsJson: '', byNote: new Map(), deckVer: 0
  };
  for (const m of defaultModels()) c.models[String(m.id)] = m;
  const basic = Object.values(c.models).find(m => m.name === 'Basic');
  c.conf = { nextPos: 1, estTimes: true, activeDecks: [1], sortType: 'noteFld', timeLim: 0, sortBackwards: false, addToCur: true, curDeck: 1, newBury: true, newSpread: 0, dueCounts: true, curModel: String(basic.id), collapseTime: 1200 };
  return c;
}

/* ---- load ---- */
function loadDb(bytes) {
  const db = new SQL.Database(bytes);
  try {
    const t = db.exec("select name from sqlite_master where type='table'");
    const tables = t.length ? t[0].values.map(v => v[0]) : [];
    if (tables.includes('notetypes')) throw new UserError('Koleksi ini memakai skema Anki terbaru. Di Anki, ekspor ulang dengan mencentang “Support older Anki versions”, lalu buka di sini.');
    if (!tables.includes('col') || !tables.includes('notes') || !tables.includes('cards')) throw new UserError('File ini bukan koleksi Anki yang valid (tabel col/notes/cards tidak ada).');
    const r = db.exec('select id,crt,mod,scm,ver,dty,usn,ls,conf,models,decks,dconf,tags from col')[0].values[0];
    const c = emptyCollection();
    c.meta = { id: r[0], crt: r[1], mod: r[2], scm: r[3], ver: r[4], dty: r[5], usn: r[6], ls: r[7] };
    c.conf = JSON.parse(r[8] || '{}'); c.models = JSON.parse(r[9] || '{}'); c.decks = JSON.parse(r[10] || '{}'); c.dconf = JSON.parse(r[11] || '{}');
    if (!Object.keys(c.models).length) throw new UserError('Koleksi tidak memiliki tipe catatan.');
    if (!c.decks['1']) c.decks['1'] = makeDeckObj('Default', 1);
    const nr = db.exec('select id,guid,mid,mod,usn,tags,flds,flags,data from notes');
    if (nr.length) for (const v of nr[0].values) {
      const m = c.models[String(v[2])]; const f = String(v[6]).split('\x1f');
      if (m) while (f.length < m.flds.length) f.push('');
      c.notes.set(v[0], { id: v[0], guid: v[1], mid: v[2], mod: v[3], usn: v[4], tags: parseTags(v[5]), fields: f, flags: v[7], data: v[8] });
    }
    const cr = db.exec('select id,nid,did,ord,mod,usn,type,queue,due,ivl,factor,reps,lapses,left,odue,odid,flags,data from cards');
    let maxDue = 0;
    if (cr.length) for (const v of cr[0].values) {
      c.cards.set(v[0], { id: v[0], nid: v[1], did: v[2], ord: v[3], mod: v[4], usn: v[5], type: v[6], queue: v[7], due: v[8], ivl: v[9], factor: v[10], reps: v[11], lapses: v[12], left: v[13], odue: v[14], odid: v[15], flags: v[16], data: v[17] });
      if (v[6] === 0 && v[8] > maxDue) maxDue = v[8];
    }
    c.nextPos = Math.max(c.conf.nextPos || 1, maxDue + 1);
    c.origModelsJson = JSON.stringify(c.models);
    return c;
  } finally { db.close(); }
}
async function openPackage(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let zip; try { zip = await JSZip.loadAsync(buf); } catch (e) { throw new UserError('File ini bukan paket Anki (.apkg) yang valid: bukan arsip ZIP.'); }
  const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
  const dbName = names.includes('collection.anki21') ? 'collection.anki21' : names.includes('collection.anki2') ? 'collection.anki2' : null;
  if (!dbName) {
    if (names.includes('collection.anki21b')) throw new UserError('Paket ini memakai format Anki terbaru (anki21b). Di Anki, ekspor ulang dengan mencentang “Support older Anki versions (slower, larger files)”, lalu buka di sini.');
    throw new UserError('Tidak ada collection.anki2 atau collection.anki21 di dalam paket.');
  }
  const dbBytes = await zip.file(dbName).async('uint8array');
  const c = loadDb(dbBytes);
  c.name = file.name; c.kind = 'apkg'; c.dbBytes = dbBytes; c.dbName = dbName;
  const mf = zip.file('media'); let map = {};
  if (mf) { try { map = JSON.parse(await mf.async('string')); } catch (e) { map = {}; } }
  for (const [idx, nm] of Object.entries(map)) { const f = zip.file(idx); if (f) c.media.set(nm, { bytes: await f.async('uint8array') }); }
  for (const n of names) { if (n === dbName || n === 'media' || /^\d+$/.test(n)) continue; if (n.startsWith('collection.')) c.extras[n] = await zip.file(n).async('uint8array'); }
  return c;
}

/* ---- indexes ---- */
function reindex() {
  C.byNote = new Map();
  for (const c of C.cards.values()) { let a = C.byNote.get(c.nid); if (!a) { a = []; C.byNote.set(c.nid, a); } a.push(c); }
  for (const a of C.byNote.values()) if (a.length > 1) a.sort((x, y) => x.ord - y.ord);
  const deckById = new Map(Object.values(C.decks).map(d => [d.id, d.name]));
  C.deckNotes = new Map(); C.tagCounts = new Map(); C.modelCounts = new Map();
  const add = (name, nid) => { let s = C.deckNotes.get(name); if (!s) { s = new Set(); C.deckNotes.set(name, s); } s.add(nid); };
  for (const c of C.cards.values()) {
    const nm = deckById.get(c.did) || '(deck hilang)'; const p = nm.split('::'); let acc = '';
    for (const part of p) { acc = acc ? acc + '::' + part : part; add(acc, c.nid); }
  }
  for (const n of C.notes.values()) {
    for (const t of n.tags) C.tagCounts.set(t, (C.tagCounts.get(t) || 0) + 1);
    C.modelCounts.set(n.mid, (C.modelCounts.get(n.mid) || 0) + 1);
  }
}
function touch(n) { n._v = (n._v | 0) + 1; }
function deckName(did) { const d = C.decks[String(did)]; return d ? d.name : '(deck hilang)'; }
function findDeck(name) { for (const d of Object.values(C.decks)) if (d.name === name) return d.id; return null; }
function createDeck(name) {
  const parts = String(name).split('::').map(s => s.trim()).filter(Boolean); let acc = '', id = null;
  if (!parts.length) return 1;
  for (const p of parts) { acc = acc ? acc + '::' + p : p; id = findDeck(acc); if (id == null) { const d = makeDeckObj(acc); C.decks[String(d.id)] = d; id = d.id; } }
  C.deckVer++; return id;
}
function deckIdByName(name) { name = String(name || '').trim(); if (!name) return 1; const id = findDeck(name); return id != null ? id : createDeck(name); }
function modelByName(n) { return Object.values(C.models).find(m => m.name.toLowerCase() === String(n).toLowerCase()); }
function resolveModel(name) { let m = modelByName(name); if (m) return m; const d = defaultModels().find(x => x.name.toLowerCase() === String(name).trim().toLowerCase()); if (d) { C.models[String(d.id)] = d; return d; } return null; }
function sortedModels() { return Object.values(C.models).sort((a, b) => naturalCmp(a.name, b.name)); }
function fieldIndex(model, name) { return model.flds.findIndex(f => f.name.toLowerCase() === String(name).toLowerCase()); }

/* ---- cards ---- */
function neededOrds(note, model) {
  if (!model) return [];
  if (model.type === 1) {
    const s = new Set(); for (const f of note.fields) for (const m of String(f).matchAll(/\{\{c(\d+)::/g)) s.add(+m[1] - 1);
    return [...s].filter(o => o >= 0).sort((a, b) => a - b);
  }
  const F = fieldMap(note, model); const out = [];
  model.tmpls.forEach((t, i) => { if (stripHtml(renderTpl(t.qfmt, F, { check: true, model, note, ord: i, side: 'q' })).length) out.push(i); });
  return out;
}
function addCard(nid, did, ord) {
  const c = { id: newId(), nid, did, ord, mod: sec(), usn: -1, type: 0, queue: 0, due: C.nextPos++, ivl: 0, factor: 0, reps: 0, lapses: 0, left: 0, odue: 0, odid: 0, flags: 0, data: '' };
  C.cards.set(c.id, c); let a = C.byNote.get(nid); if (!a) { a = []; C.byNote.set(nid, a); } a.push(c); return c;
}
function syncCards(note, did) {
  const model = C.models[String(note.mid)]; if (!model) return 0;
  const have = new Set((C.byNote.get(note.id) || []).map(c => c.ord)); let added = 0;
  if (did == null) { const cs = C.byNote.get(note.id); did = cs && cs.length ? cs[0].did : 1; }
  for (const o of neededOrds(note, model)) if (!have.has(o)) { addCard(note.id, did, o); added++; }
  return added;
}
function padFields(f, model) { const a = f.slice(); while (a.length < model.flds.length) a.push(''); return a.slice(0, Math.max(model.flds.length, 1)); }
function addNote({ mid, fields, tags = [], deck, guid }) {
  const model = C.models[String(mid)];
  const note = { id: newId(), guid: guid || genGuid(), mid: model.id, mod: sec(), usn: -1, tags: tags.slice(), fields: padFields(fields, model), flags: 0, data: '' };
  C.notes.set(note.id, note); C.byNote.set(note.id, []); syncCards(note, deckIdByName(deck)); touch(note); return note;
}
function deleteNotes(ids) {
  const s = new Set(ids);
  for (const id of s) C.notes.delete(id);
  for (const c of [...C.cards.values()]) if (s.has(c.nid)) C.cards.delete(c.id);
  for (const id of s) { C.byNote.delete(id); ROW.delete(id); }
}
function moveNotes(ids, did) {
  for (const id of ids) { const n = C.notes.get(id); for (const c of (C.byNote.get(id) || [])) { c.did = did; c.mod = sec(); c.usn = -1; } if (n) touch(n); }
}
function addTagsTo(ids, tags) {
  for (const id of ids) { const n = C.notes.get(id); if (!n) continue; let ch = false; for (const t of tags) if (!n.tags.includes(t)) { n.tags.push(t); ch = true; } if (ch) { n.mod = sec(); n.usn = -1; touch(n); } }
}
function removeTagsFrom(ids, tags) {
  const rm = new Set(tags.map(t => t.toLowerCase()));
  for (const id of ids) { const n = C.notes.get(id); if (!n) continue; const k = n.tags.filter(t => !rm.has(t.toLowerCase())); if (k.length !== n.tags.length) { n.tags = k; n.mod = sec(); n.usn = -1; touch(n); } }
}
function renameTag(oldT, newT) {
  let cnt = 0;
  for (const n of C.notes.values()) {
    let ch = false; const out = [];
    for (const t of n.tags) {
      let r = t;
      if (t === oldT) r = newT; else if (t.startsWith(oldT + '::')) r = newT + t.slice(oldT.length);
      if (r !== t) ch = true; if (!out.includes(r)) out.push(r);
    }
    if (ch) { n.tags = out; n.mod = sec(); n.usn = -1; touch(n); cnt++; }
  }
  return cnt;
}
function deleteTag(t) {
  let cnt = 0;
  for (const n of C.notes.values()) { const k = n.tags.filter(x => x !== t && !x.startsWith(t + '::')); if (k.length !== n.tags.length) { n.tags = k; n.mod = sec(); n.usn = -1; touch(n); cnt++; } }
  return cnt;
}
function setField(note, i, val) {
  if (note.fields[i] === val) return false;
  note.fields[i] = val; note.mod = sec(); note.usn = -1; touch(note); return true;
}
function renameDeck(oldName, newName) {
  newName = newName.split('::').map(s => s.trim()).filter(Boolean).join('::');
  if (!newName) throw new UserError('Nama deck tidak boleh kosong.');
  if (newName === oldName) return 0;
  if (newName.startsWith(oldName + '::')) throw new UserError('Deck tidak bisa dipindah ke dalam dirinya sendiri.');
  let n = 0;
  for (const d of Object.values(C.decks)) {
    if (d.name === oldName || d.name.startsWith(oldName + '::')) {
      const nn = newName + d.name.slice(oldName.length);
      if (nn !== d.name && findDeck(nn) != null && findDeck(nn) !== d.id) throw new UserError('Sudah ada deck bernama “' + nn + '”.');
      d.name = nn; d.mod = sec(); d.usn = -1; n++;
    }
  }
  C.deckVer++; return n;
}
function deleteDeck(name, moveTo) {
  const ids = Object.values(C.decks).filter(d => (d.name === name || d.name.startsWith(name + '::')) && d.id !== 1).map(d => d.id);
  const set = new Set(ids); const noteIds = new Set();
  for (const c of [...C.cards.values()]) if (set.has(c.did)) {
    if (moveTo != null) { c.did = moveTo; c.mod = sec(); c.usn = -1; const n = C.notes.get(c.nid); if (n) touch(n); }
    else { C.cards.delete(c.id); noteIds.add(c.nid); }
  }
  if (moveTo == null) { reindex(); const gone = [...noteIds].filter(id => !(C.byNote.get(id) || []).length); deleteNotes(gone); }
  for (const id of ids) delete C.decks[String(id)];
  C.deckVer++;
}
function setSuspended(ids, on) {
  for (const id of ids) { for (const c of (C.byNote.get(id) || [])) { c.queue = on ? -1 : (c.type === 0 ? 0 : (c.type === 3 ? 1 : c.type)); c.mod = sec(); c.usn = -1; } const n = C.notes.get(id); if (n) touch(n); }
}
function duplicateNotes(ids) {
  const out = [];
  for (const id of ids) {
    const n = C.notes.get(id); if (!n) continue; const cs = C.byNote.get(id) || []; const did = cs.length ? cs[0].did : 1;
    const nn = { id: newId(), guid: genGuid(), mid: n.mid, mod: sec(), usn: -1, tags: n.tags.slice(), fields: n.fields.slice(), flags: 0, data: '' };
    C.notes.set(nn.id, nn); C.byNote.set(nn.id, []);
    for (const c of cs) addCard(nn.id, did, c.ord); syncCards(nn, did); touch(nn); out.push(nn.id);
  }
  return out;
}
function changeNoteType(ids, newMid, fmap, tmap) {
  const nm = C.models[String(newMid)];
  for (const id of ids) {
    const n = C.notes.get(id); if (!n) continue; const old = n.fields.slice();
    n.fields = nm.flds.map((_, j) => { const src = fmap.indexOf(j); return src >= 0 ? (old[src] || '') : ''; });
    n.mid = nm.id; n.mod = sec(); n.usn = -1;
    for (const c of (C.byNote.get(id) || []).slice()) {
      const no = tmap[c.ord];
      if (no == null || no < 0 || no >= nm.tmpls.length) C.cards.delete(c.id); else { c.ord = no; c.mod = sec(); c.usn = -1; }
    }
    C.byNote.set(id, [...C.cards.values()].filter(c => c.nid === id)); syncCards(n); touch(n);
  }
}
/* find & replace */
function buildFinder(find, { regex, matchCase }) {
  const src = regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(src, 'g' + (matchCase ? '' : 'i'));
}
function replaceInNotes(ids, { find, repl, regex, matchCase, field, dry }) {
  const re = buildFinder(find, { regex, matchCase }); let notes = 0, hits = 0; const samples = [];
  const doRepl = s => { let k = 0; const out = s.replace(re, (...a) => { k++; if (regex) { return repl.replace(/\$(\d+|&)/g, (m, g) => g === '&' ? a[0] : (typeof a[+g] === 'string' ? a[+g] : '')); } return repl; }); return [out, k]; };
  for (const id of ids) {
    const n = C.notes.get(id); if (!n) continue; const model = C.models[String(n.mid)]; let changed = false;
    if (field === '#tags') {
      const nt = []; let k = 0; for (const t of n.tags) { const [o, c] = doRepl(t); k += c; o.split(/\s+/).filter(Boolean).forEach(x => { if (!nt.includes(x)) nt.push(x); }); }
      if (k) { hits += k; changed = true; if (samples.length < 8) samples.push([n.tags.join(' '), nt.join(' ')]); if (!dry) { n.tags = nt; } }
    } else {
      n.fields.forEach((f, i) => {
        if (field !== '*') { if (!model || fieldIndex(model, field) !== i) return; }
        re.lastIndex = 0; const [o, c] = doRepl(f);
        if (c && o !== f) { hits += c; changed = true; if (samples.length < 8) samples.push([f, o]); if (!dry) n.fields[i] = o; }
      });
    }
    if (changed) { notes++; if (!dry) { n.mod = sec(); n.usn = -1; touch(n); syncCards(n); } }
  }
  return { notes, hits, samples };
}

/* ---- undo ---- */
const UNDO = { stack: [], redo: [], max: 30, typingKey: null, typingAt: 0 };
function snapshot() {
  return JSON.stringify({
    decks: C.decks, models: C.models, dconf: C.dconf, conf: C.conf, nextPos: C.nextPos, deckVer: C.deckVer,
    notes: [...C.notes.values()], cards: [...C.cards.values()]
  });
}
function restore(s) {
  const o = JSON.parse(s);
  C.decks = o.decks; C.models = o.models; C.dconf = o.dconf; C.conf = o.conf; C.nextPos = o.nextPos; C.deckVer = (C.deckVer | 0) + 1;
  C.notes = new Map(o.notes.map(n => [n.id, n])); C.cards = new Map(o.cards.map(c => [c.id, c]));
  ROW.clear(); reindex();
}
function pushUndo(label) {
  const s = snapshot(); UNDO.stack.push({ label, s }); UNDO.redo.length = 0;
  const maxN = Math.max(3, Math.min(30, Math.floor(40e6 / Math.max(1, s.length)))); while (UNDO.stack.length > maxN) UNDO.stack.shift();
}
function undo() {
  const e = UNDO.stack.pop(); if (!e) return null;
  UNDO.redo.push({ label: e.label, s: snapshot() }); restore(e.s); C.dirty = true; UNDO.typingKey = null; return e.label;
}
function redo() {
  const e = UNDO.redo.pop(); if (!e) return null;
  UNDO.stack.push({ label: e.label, s: snapshot() }); restore(e.s); C.dirty = true; UNDO.typingKey = null; return e.label;
}

/* ---- media helpers ---- */
const MEDIA_URL = new Map();
function mediaUrl(name) {
  if (MEDIA_URL.has(name)) return MEDIA_URL.get(name);
  const m = C.media.get(name); if (!m) return null;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', flac: 'audio/flac', opus: 'audio/ogg', spx: 'audio/ogg' };
  const u = URL.createObjectURL(new Blob([m.bytes], { type: types[ext] || 'application/octet-stream' })); MEDIA_URL.set(name, u); return u;
}
function mediaKind(name) { const e = (name.split('.').pop() || '').toLowerCase(); if (/^(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(e)) return 'image'; if (/^(mp3|ogg|wav|m4a|flac|opus|spx|aac)$/.test(e)) return 'audio'; if (/^(mp4|webm|mov|mkv)$/.test(e)) return 'video'; return 'other'; }
function mediaRefs(html) {
  const out = new Set(); const s = String(html);
  for (const m of s.matchAll(/<(?:img|audio|video|source)[^>]+src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) out.add(m[1] || m[2] || m[3]);
  for (const m of s.matchAll(/\[sound:([^\]]+)\]/g)) out.add(m[1]);
  for (const m of s.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) out.add(m[1]);
  const more = []; for (const r of out) { try { const d = decodeURIComponent(r); if (d !== r) more.push(d); } catch (e) { } } more.forEach(x => out.add(x));
  return out;
}
function usedMediaSet() {
  const used = new Set();
  for (const n of C.notes.values()) for (const f of n.fields) for (const r of mediaRefs(f)) used.add(r);
  for (const m of Object.values(C.models)) { for (const t of m.tmpls) for (const r of mediaRefs(t.qfmt + t.afmt)) used.add(r); for (const r of mediaRefs(m.css)) used.add(r); }
  return used;
}
function addMediaFile(name, bytes) {
  name = name.replace(/[\\/:*?"<>|]+/g, '_'); let nm = name, i = 1;
  while (C.media.has(nm)) { const dot = name.lastIndexOf('.'); nm = dot > 0 ? name.slice(0, dot) + '-' + i + name.slice(dot) : name + '-' + i; i++; }
  C.media.set(nm, { bytes }); return nm;
}

/* ---- export ---- */
function buildDbBytes(src) {
  let db;
  if (src.dbBytes) db = new SQL.Database(src.dbBytes);
  else {
    db = new SQL.Database(); db.run(SCHEMA);
    db.run('insert into col values (1,?,?,?,11,0,0,0,?,?,?,?,?)', [src.meta.crt, Date.now(), Date.now(), '{}', '{}', '{}', '{}', '{}']);
  }
  db.run('begin'); db.run('delete from notes'); db.run('delete from cards');
  const tagSet = new Set();
  const ins = db.prepare('insert into notes values (?,?,?,?,?,?,?,?,?,?,?)');
  for (const n of src.notes.values()) {
    const model = src.models[String(n.mid)]; const sf = model ? (n.fields[model.sortf] || '') : (n.fields[0] || '');
    n.tags.forEach(t => tagSet.add(t));
    ins.run([n.id, n.guid, n.mid, n.mod, n.usn, tagsToStr(n.tags), n.fields.join('\x1f'), stripHtml(sf), csumOf(n.fields[0] || ''), n.flags || 0, n.data || '']);
  }
  ins.free();
  const insC = db.prepare('insert into cards values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const c of src.cards.values()) insC.run([c.id, c.nid, c.did, c.ord, c.mod, c.usn, c.type, c.queue, c.due, c.ivl, c.factor, c.reps, c.lapses, c.left, c.odue, c.odid, c.flags || 0, c.data || '']);
  insC.free();
  if (src.dbBytes) db.run('delete from revlog where cid not in (select id from cards)');
  const modelsJson = JSON.stringify(src.models); const changed = modelsJson !== src.origModelsJson; const tm = {}; tagSet.forEach(t => tm[t] = 0);
  const conf = Object.assign({}, src.conf, { nextPos: src.nextPos });
  db.run('update col set decks=?, models=?, dconf=?, conf=?, tags=?, mod=?, scm=?', [JSON.stringify(src.decks), modelsJson, JSON.stringify(src.dconf), JSON.stringify(conf), JSON.stringify(tm), Date.now(), changed ? Date.now() : src.meta.scm]);
  db.run('commit');
  const out = db.export(); db.close(); return out;
}
async function buildApkgBytes(src) {
  const dbBytes = buildDbBytes(src); const zip = new JSZip();
  zip.file(src.dbName || 'collection.anki2', dbBytes);
  for (const [n, b] of Object.entries(src.extras || {})) zip.file(n, b);
  const map = {}; let i = 0;
  for (const [name, m] of src.media) { map[i] = name; zip.file(String(i), m.bytes); i++; }
  zip.file('media', JSON.stringify(map));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
function subsetCollection(noteIds) {
  const set = new Set(noteIds); const src = emptyCollection(C.name);
  src.models = {}; src.decks = {}; src.conf = Object.assign({}, C.conf); src.dconf = Object.assign({}, C.dconf); src.meta = Object.assign({}, C.meta);
  src.decks['1'] = JSON.parse(JSON.stringify(C.decks['1'] || makeDeckObj('Default', 1)));
  const usedDecks = new Set(); const usedModels = new Set(); const refs = new Set();
  for (const id of set) { const n = C.notes.get(id); if (!n) continue; src.notes.set(id, JSON.parse(JSON.stringify(n))); usedModels.add(String(n.mid)); n.fields.forEach(f => mediaRefs(f).forEach(r => refs.add(r))); }
  for (const c of C.cards.values()) if (set.has(c.nid)) { src.cards.set(c.id, JSON.parse(JSON.stringify(c))); usedDecks.add(c.did); }
  for (const mid of usedModels) { const m = C.models[mid]; if (m) { src.models[mid] = JSON.parse(JSON.stringify(m)); for (const t of m.tmpls) mediaRefs(t.qfmt + t.afmt).forEach(r => refs.add(r)); mediaRefs(m.css).forEach(r => refs.add(r)); } }
  const need = new Set(); for (const did of usedDecks) { const d = C.decks[String(did)]; if (!d) continue; const p = d.name.split('::'); let acc = ''; for (const part of p) { acc = acc ? acc + '::' + part : part; need.add(acc); } }
  for (const d of Object.values(C.decks)) if (need.has(d.name) || d.id === 1) src.decks[String(d.id)] = JSON.parse(JSON.stringify(d));
  for (const [nm, m] of C.media) if (refs.has(nm)) src.media.set(nm, m);
  src.nextPos = C.nextPos; src.origModelsJson = ''; src.dbBytes = null; src.dbName = 'collection.anki2'; src.extras = {};
  return src;
}
function noteBundle(src) { return src; }

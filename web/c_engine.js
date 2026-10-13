/* ============ template engine ============ */
function fieldMap(note, model) { const F = {}; model.flds.forEach((f, i) => { F[f.name] = note.fields[i] == null ? '' : note.fields[i]; }); return F; }
function clozeRender(text, ord, side) {
  return text.replace(/\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (m, n, ans, hint) => {
    if (+n === ord + 1) return side === 'q' ? '<span class="cloze">[' + (hint ? hint : '...') + ']</span>' : '<span class="cloze">' + ans + '</span>';
    return ans;
  });
}
function renderTpl(tpl, F, ctx) {
  let t = String(tpl == null ? '' : tpl); let guard = 0, prev;
  const nonEmpty = name => { name = name.trim(); if (name in F) return stripHtml(F[name]).length > 0 || /<(img|audio|video)/i.test(F[name]); return false; };
  do {
    prev = t;
    t = t.replace(/\{\{([#^])\s*([^}]+?)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g, (m, kind, name, inner) => {
      const has = nonEmpty(name); return ((kind === '#') === has) ? inner : '';
    });
  } while (t !== prev && ++guard < 20);
  return t.replace(/\{\{([^}]+?)\}\}/g, (m, body) => {
    body = body.trim(); const parts = body.split(':').map(s => s.trim()); const name = parts.pop(); const filters = parts;
    if (/^[#^\/]/.test(name)) return '';
    const special = { FrontSide: 1, Tags: 1, Deck: 1, Subdeck: 1, Card: 1, Type: 1, CardFlag: 1 };
    let val;
    if (name in F) val = F[name];
    else if (special[name] && !filters.length) {
      if (ctx.check) return '';
      if (name === 'FrontSide') return ctx.frontSide || '';
      if (name === 'Tags') return esc((ctx.note.tags || []).join(' '));
      if (name === 'Deck') return esc(ctx.deck || ''); if (name === 'Subdeck') return esc((ctx.deck || '').split('::').pop());
      if (name === 'Card') return esc((ctx.model.tmpls[ctx.model.type === 1 ? 0 : ctx.ord] || {}).name || '');
      if (name === 'Type') return esc(ctx.model.name); return '';
    } else return ctx.check ? '' : '<span style="color:#b3342d">{unknown field ' + esc(name) + '}</span>';
    for (let i = filters.length - 1; i >= 0; i--) {
      const f = filters[i].toLowerCase();
      if (f === 'text') val = stripHtml(val);
      else if (f === 'cloze') val = clozeRender(val, ctx.ord, ctx.side);
      else if (f === 'hint') val = stripHtml(val) ? '<details style="display:inline"><summary>Petunjuk</summary>' + val + '</details>' : '';
      else if (f === 'type') val = ctx.side === 'a' ? '<code>' + esc(stripHtml(val)) + '</code>' : '<span style="display:inline-block;min-width:8em;border:1px dashed #888;padding:2px 8px;border-radius:4px;opacity:.7">[ketik jawaban]</span>';
      else if (f === 'furigana') val = val.replace(/ ?([^ >\[\]]+?)\[(?!sound:)(.+?)\]/g, '<ruby><rb>$1</rb><rt>$2</rt></ruby>');
      else if (f === 'kanji') val = val.replace(/ ?([^ >\[\]]+?)\[(?!sound:)(.+?)\]/g, '$1');
      else if (f === 'kana') val = val.replace(/ ?([^ >\[\]]+?)\[(?!sound:)(.+?)\]/g, '$2');
    }
    return val;
  });
}
function renderCard(note, ord) {
  const model = C.models[String(note.mid)]; const F = fieldMap(note, model);
  const t = model.tmpls[model.type === 1 ? 0 : ord] || model.tmpls[0];
  const cs = C.byNote.get(note.id) || []; const card = cs.find(c => c.ord === ord); const ctx = { model, note, ord, deck: card ? deckName(card.did) : '' };
  const q = renderTpl(t.qfmt, F, Object.assign({ side: 'q' }, ctx));
  const a = renderTpl(t.afmt, F, Object.assign({ side: 'a', frontSide: q }, ctx));
  return { q, a };
}
function rewriteMedia(html) {
  html = html.replace(/\[sound:([^\]]+)\]/g, (m, n) => { const u = mediaUrl(n); return u ? '<audio controls preload="none" src="' + u + '"></audio>' : '<span style="opacity:.6">[sound:' + esc(n) + ' tidak ada]</span>'; });
  return html.replace(/(<(?:img|audio|video|source)[^>]*?\ssrc\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi, (m, pre, a, b) => {
    const raw = a != null ? a : b; let u = mediaUrl(raw); if (!u) { try { u = mediaUrl(decodeURIComponent(raw)); } catch (e) { } }
    return u ? pre + '"' + u + '"' : m;
  });
}

/* ============ search ============ */
function wildRe(text, anchored, suffix) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length && /[*_\\:"]/.test(text[i + 1])) { out += text[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++; }
    else if (ch === '*') out += '[\\s\\S]*'; else if (ch === '_') out += '[\\s\\S]';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(anchored ? '^(?:' + out + ')' + (suffix || '') + '$' : out, 'i');
}
function tokenizeQuery(q) {
  const out = []; let i = 0; const n = q.length;
  while (i < n) {
    while (i < n && /\s/.test(q[i])) i++; if (i >= n) break;
    let neg = false; if (q[i] === '-' && i + 1 < n && !/\s/.test(q[i + 1])) { neg = true; i++; }
    let s = '', quoted = false;
    while (i < n && !/\s/.test(q[i])) {
      if (q[i] === '"') { quoted = true; i++; while (i < n && q[i] !== '"') { s += q[i]; i++; } i++; } else { s += q[i]; i++; }
    }
    out.push({ neg, s, quoted });
  }
  return out;
}
function compileSearch(q) {
  q = String(q || '').trim(); if (!q) return null;
  const toks = tokenizeQuery(q); const groups = [[]];
  for (const t of toks) { if (!t.quoted && !t.neg && t.s.toLowerCase() === 'or') { groups.push([]); continue; } if (!t.s && !t.quoted) continue; groups[groups.length - 1].push(compileTerm(t)); }
  const gs = groups.filter(g => g.length);
  if (!gs.length) return null;
  return (n, r) => gs.some(g => g.every(f => f(n, r)));
}
function compileTerm(t) {
  const f = compileTermInner(t.s); return t.neg ? (n, r) => !f(n, r) : f;
}
function compileTermInner(s) {
  const m = s.match(/^([^:\s][^:]*):([\s\S]*)$/);
  if (m) {
    const key = m[1].toLowerCase(); const val = m[2];
    if (key === 'deck') { const re = wildRe(val, true, '(?:::[\\s\\S]*)?'); return (n, r) => (C.byNote.get(n.id) || []).some(c => re.test(deckName(c.did))); }
    if (key === 'tag') { if (val.toLowerCase() === 'none') return n => !n.tags.length; const re = wildRe(val, true, '(?:::[\\s\\S]*)?'); return n => n.tags.some(t => re.test(t)); }
    if (key === 'note' || key === 'model') { const re = wildRe(val, true); return n => { const mo = C.models[String(n.mid)]; return !!mo && re.test(mo.name); }; }
    if (key === 'card') { const num = /^\d+$/.test(val) ? +val - 1 : -1; const re = wildRe(val, true); return n => { const mo = C.models[String(n.mid)]; return (C.byNote.get(n.id) || []).some(c => num >= 0 ? c.ord === num : (mo && mo.tmpls[c.ord] && re.test(mo.tmpls[c.ord].name))); }; }
    if (key === 'is') {
      const v = val.toLowerCase(); const cs = n => C.byNote.get(n.id) || [];
      if (v === 'new') return n => cs(n).some(c => c.type === 0); if (v === 'review') return n => cs(n).some(c => c.type === 2);
      if (v === 'learn') return n => cs(n).some(c => c.type === 1 || c.type === 3);
      if (v === 'suspended') return n => cs(n).some(c => c.queue === -1); if (v === 'buried') return n => cs(n).some(c => c.queue === -2 || c.queue === -3);
      return () => false;
    }
    if (key === 'added') { const d = +val; return n => n.id / 1000 > Date.now() / 1000 - d * 86400; }
    if (key === 'edited') { const d = +val; return n => n.mod > Date.now() / 1000 - d * 86400; }
    if (key === 'nid') { const ids = new Set(val.split(',').map(x => +x)); return n => ids.has(n.id); }
    if (key === 're') { let re; try { re = new RegExp(val, 'i'); } catch (e) { return () => false; } return n => re.test(rowFor(n).textAll); }
    if (key === 'dupe') return () => false;
    const hasField = Object.values(C.models).some(mo => mo.flds.some(fl => fl.name.toLowerCase() === key));
    if (hasField) {
      const re = wildRe(val, true);
      return n => { const mo = C.models[String(n.mid)]; if (!mo) return false; const i = mo.flds.findIndex(fl => fl.name.toLowerCase() === key); if (i < 0) return false; return re.test(stripHtml(n.fields[i] || '')); };
    }
  }
  const re = wildRe(s, false); return n => re.test(rowFor(n).textAll);
}
function rowFor(note) {
  let r = ROW.get(note.id);
  if (r && r.v === (note._v | 0) && r.dv === C.deckVer) return r;
  const model = C.models[String(note.mid)]; const cs = C.byNote.get(note.id) || []; const f = note.fields;
  const names = [...new Set(cs.map(c => deckName(c.did)))];
  const sf = model ? (f[model.sortf] || '') : (f[0] || '');
  const f1 = stripHtml(sf); const rest = f.filter((_, i) => !model || i !== model.sortf).map(stripHtml).filter(Boolean).join(' · ');
  r = {
    v: note._v | 0, dv: C.deckVer, f1, f2: rest, decks: names, deck: names[0] || '', tagsStr: note.tags.join(' '), model: model ? model.name : '?',
    textAll: stripHtml(f.join(' | ')) + ' ' + '', cards: cs.length, susp: cs.some(c => c.queue === -1)
  };
  ROW.set(note.id, r); return r;
}

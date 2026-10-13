/* =====================================================================
   K-Movies (Kanandzika Movies) - ecrã estilo Netflix, no app do cliente
   Filmes e séries em português, com legendas em português e opção de BAIXAR
   para ver sem internet (guardado no telemóvel, em IndexedDB).
   Depende de home.html: sb, $, esc, toast, openSheet, closeSheets, setNav, load, save
   Catálogo: tabelas k_titles / k_episodios (taxi.sql).
   ===================================================================== */
(function () {
  const SV = (p, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${p}</svg>`;
  const IC = {
    play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>', down: '<path d="M12 3v12M7 11l5 5 5-5M5 20h14"/>',
    ok: '<path d="M5 12l5 5 9-10"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', back: '<path d="M15 5l-7 7 7 7"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>', film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'
  };
  const KM = { items: [], eps: {}, cat: 'inicio', q: '', busca: false, dl: {}, prog: {}, ctl: {}, cur: null, offline: false, ia: load('km_ia', []), iaMode: 'pop', iaQ: '', iaBusy: false, iaT: null, lista: load('km_lista', []), pos: load('km_pos', {}), loaded: false, vid: null, urls: [] };

  /* ---------- IndexedDB (downloads) ---------- */
  const IDB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((ok, no) => {
        const r = indexedDB.open('kmovies', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('meta', { keyPath: 'key' }); r.result.createObjectStore('files'); };
        r.onsuccess = () => { this.db = r.result; ok(r.result); }; r.onerror = () => no(r.error);
      });
    },
    async tx(store, mode, fn) { const db = await this.open(); return new Promise((ok, no) => { const t = db.transaction(store, mode), s = t.objectStore(store), q = fn(s); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error); }); },
    metas() { return this.tx('meta', 'readonly', s => s.getAll()); },
    file(k) { return this.tx('files', 'readonly', s => s.get(k)); },
    async guardar(meta, file) { const db = await this.open(); return new Promise((ok, no) => { const t = db.transaction(['meta', 'files'], 'readwrite'); t.objectStore('files').put(file, meta.key); t.objectStore('meta').put(meta); t.oncomplete = ok; t.onerror = () => no(t.error); t.onabort = () => no(t.error); }); },
    async apagar(k) { const db = await this.open(); return new Promise((ok, no) => { const t = db.transaction(['meta', 'files'], 'readwrite'); t.objectStore('files').delete(k); t.objectStore('meta').delete(k); t.oncomplete = ok; t.onerror = () => no(t.error); }); }
  };

  /* ---------- HTML dos ecrãs ---------- */
  const app = document.querySelector('.app');
  const mk = (id, html) => { const d = document.createElement('div'); d.className = 'sheet km'; d.id = id; d.innerHTML = html; app.appendChild(d); };
  mk('sh-movies', `
    <div class="km-top" id="kmTop"><button class="km-ib" onclick="KMovies.fechar()" aria-label="Voltar">${SV(IC.back, 24)}</button><div class="km-logo">K<span>-MOVIES</span></div><button class="km-ib" onclick="KMovies.busca()" aria-label="Pesquisar">${SV(IC.search, 22)}</button></div>
    <div class="km-searchbar" id="kmSb"><input id="kmQ" placeholder="Pesquisar filmes e séries" autocomplete="off" oninput="KMovies.q(this.value)"></div>
    <div class="km-scroll" id="kmBody"></div>`);
  mk('sh-mdet', `<div class="km-scroll" id="kmDet"></div><button class="km-ib km-fx" onclick="KMovies.voltarDet()" aria-label="Fechar">${SV(IC.x, 22)}</button>`);
  mk('sh-mplay', `<div class="km-ptop"><button class="km-ib" onclick="KMovies.fecharPlayer()" aria-label="Voltar">${SV(IC.back, 24)}</button><div id="kmPT" class="km-ptitle"></div></div><div class="km-pwrap" id="kmPW"></div><div class="km-pnext" id="kmPN"></div>`);

  const css = document.createElement('style');
  css.textContent = `
  .sheet.km{background:#0a0a0d;color:#fff;font-family:"IBM Plex Sans",system-ui,Arial,sans-serif}
  #sh-movies,#sh-mdet,#sh-mplay{z-index:40}
  .km-top{position:absolute;top:0;left:0;right:0;z-index:6;display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 10px 28px;background:linear-gradient(180deg,rgba(10,10,13,.92),rgba(10,10,13,0))}
  .km-top.sol{background:#0a0a0d}
  .km-logo{font-weight:800;font-size:22px;letter-spacing:1px;color:#ff3b4e;text-shadow:0 2px 12px rgba(255,59,78,.35)}.km-logo span{font-size:15px;letter-spacing:3px;color:#fff;margin-left:1px}
  .km-ib{width:42px;height:42px;border-radius:50%;border:0;background:rgba(0,0,0,.35);color:#fff;display:grid;place-items:center;flex:none}
  .km-searchbar{position:absolute;top:calc(58px + env(safe-area-inset-top));left:12px;right:12px;z-index:6;display:none}
  .km-searchbar.on{display:block}
  .km-searchbar input{width:100%;height:44px;border-radius:12px;border:1.5px solid #333;background:#16161b;color:#fff;padding:0 14px;font-size:15px;outline:0}
  .km-searchbar input:focus{border-color:#ff3b4e}
  .km-scroll{flex:1;overflow-y:auto;padding-bottom:calc(30px + var(--sab));scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .km-scroll::-webkit-scrollbar{display:none}
  .km-chips{display:flex;gap:8px;padding:calc(62px + env(safe-area-inset-top)) 12px 12px;overflow-x:auto;scrollbar-width:none}
  .km-chips.sb{padding-top:calc(112px + env(safe-area-inset-top))}
  .km-chips::-webkit-scrollbar{display:none}
  .km-chip{flex:none;border:1px solid #444;background:rgba(0,0,0,.35);color:#ddd;border-radius:18px;padding:7px 14px;font-size:13px;font-weight:600}
  .km-chip.on{background:#fff;color:#000;border-color:#fff}
  .km-hero{position:relative;margin:0 12px 6px;border-radius:14px;overflow:hidden;aspect-ratio:3/3.6;max-height:430px;background:#1a1a22 center/cover}
  .km-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,13,0) 35%,rgba(10,10,13,.92) 92%)}
  .km-hero .in{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:16px;text-align:center}
  .km-hero h2{font-size:30px;line-height:1.05;font-weight:800;text-shadow:0 2px 14px rgba(0,0,0,.7)}
  .km-gen{font-size:12px;color:#d6d6dc;margin:8px 0 12px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap}.km-gen i{opacity:.5;font-style:normal}
  .km-btns{display:flex;gap:10px;justify-content:center}
  .km-b{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:44px;padding:0 20px;border-radius:8px;border:0;font-weight:700;font-size:15px;background:rgba(255,255,255,.2);color:#fff}
  .km-b.p{background:#fff;color:#000}.km-b.r{background:#ff3b4e;color:#fff}
  .km-b.full{width:100%}
  .km-row{margin-top:18px}.km-row h3{font-size:16px;font-weight:700;padding:0 14px;margin-bottom:9px}
  .km-rail{display:flex;gap:9px;overflow-x:auto;padding:0 14px 4px;scrollbar-width:none;scroll-snap-type:x proximity}
  .km-rail::-webkit-scrollbar{display:none}
  .km-card{flex:none;width:112px;scroll-snap-align:start;position:relative;border:0;background:none;padding:0;color:#fff;text-align:left}
  .km-ph{width:112px;height:168px;border-radius:8px;background:#1a1a22 center/cover;position:relative;overflow:hidden;display:flex;align-items:flex-end}
  .km-ph.fb{background:linear-gradient(160deg,var(--c1,#3a1d6e),var(--c2,#0d0d14))}
  .km-ph span.t{padding:8px;font-weight:800;font-size:14px;line-height:1.15;text-shadow:0 1px 8px rgba(0,0,0,.8)}
  .km-tag{position:absolute;top:6px;left:6px;background:#ff3b4e;color:#fff;font-size:9px;font-weight:800;border-radius:4px;padding:2px 5px;letter-spacing:.5px}
  .km-dlb{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.65);display:grid;place-items:center;color:#4ade80}
  .km-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.25)}.km-bar i{display:block;height:100%;background:#ff3b4e}
  .km-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 12px}
  .km-grid .km-card,.km-grid .km-ph{width:100%}.km-grid .km-ph{height:auto;aspect-ratio:2/3}
  .km-cap{display:block;font-size:11.5px;line-height:1.25;color:#cfcfd8;margin-top:5px;max-height:2.5em;overflow:hidden}
  .km-fonte{font-size:11.5px;color:#7d7d88;line-height:1.5;padding:16px 16px 0;text-align:center}
  .km-empty{text-align:center;color:#9a9aa5;padding:70px 26px;font-size:14px;line-height:1.6}.km-empty b{display:block;color:#fff;font-size:17px;margin:10px 0 4px}
  .km-dhero{position:relative;height:330px;background:#1a1a22 center/cover}
  .km-dhero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,13,.1) 20%,#0a0a0d 98%)}
  .km-fx{position:absolute;top:calc(10px + env(safe-area-inset-top));right:10px;z-index:7}
  .km-dbody{padding:0 16px;margin-top:-62px;position:relative;z-index:2}
  .km-dbody h1{font-size:28px;line-height:1.1;font-weight:800}
  .km-meta{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:13px;color:#b9b9c4;margin:9px 0 14px}
  .km-meta b{color:#4ade80}.km-meta em{font-style:normal;border:1px solid #666;border-radius:4px;padding:0 5px;font-size:11px;color:#ddd}
  .km-syn{font-size:14px;line-height:1.55;color:#d8d8e0;margin:14px 0}
  .km-acts{display:grid;gap:9px}
  .km-mini{display:flex;gap:18px;margin:12px 0 4px}.km-mini button{background:none;border:0;color:#cfcfd8;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:5px}
  .km-ep{display:flex;gap:11px;align-items:center;padding:11px 0;border-top:1px solid #222}
  .km-ep .n{font-size:18px;font-weight:700;color:#8b8b97;width:26px;text-align:center;flex:none}
  .km-ep .t{flex:1;min-width:0}.km-ep .t b{display:block;font-size:14px}.km-ep .t span{font-size:12px;color:#9a9aa5}
  .km-ep .pb{width:38px;height:38px;border-radius:50%;border:1.5px solid #fff;background:none;color:#fff;display:grid;place-items:center;flex:none}
  .km-ep .db{width:38px;height:38px;border-radius:50%;border:0;background:#1d1d25;color:#fff;display:grid;place-items:center;flex:none;position:relative}
  .km-ep .db.ok{color:#4ade80}
  .km-sel{background:#1d1d25;color:#fff;border:1px solid #333;border-radius:8px;height:38px;padding:0 10px;font-size:14px;margin:12px 0 4px}
  .km-prog{height:6px;border-radius:3px;background:#2a2a33;overflow:hidden;margin-top:6px}.km-prog i{display:block;height:100%;width:0;background:#ff3b4e;transition:width .25s}
  #sh-mplay{background:#000}
  .km-ptop{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 10px 24px;background:linear-gradient(180deg,rgba(0,0,0,.8),rgba(0,0,0,0));pointer-events:none}
  .km-ptop>*{pointer-events:auto}.km-ptitle{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .km-pwrap{flex:1;display:grid;place-items:center;background:#000;min-height:0}
  .km-pwrap video{width:100%;max-height:100%;background:#000}
  .km-pnext{padding:10px 14px calc(14px + var(--sab));min-height:0}
  video::cue{font-size:1.1em;background:rgba(0,0,0,.7)}
  `;
  document.head.appendChild(css);

  /* ---------- catálogo ---------- */
  const COR = [['#5b1d6e', '#0d0d14'], ['#1d4f6e', '#0d0d14'], ['#6e1d2d', '#0d0d14'], ['#1d6e4a', '#0d0d14'], ['#6e5a1d', '#0d0d14']];
  const isFav = id => KM.lista.includes(id);
  const tit = id => KM.items.find(x => x.id === id) || KM.ia.find(x => x.id === id);
  const ph = (t, cls) => {
    const c = COR[t.id % COR.length];
    return t.poster_url ? `<div class="km-ph ${cls || ''}" style="background-image:url('${esc(t.poster_url)}')">` : `<div class="km-ph fb ${cls || ''}" style="--c1:${c[0]};--c2:${c[1]}"><span class="t">${esc(t.titulo)}</span>`;
  };
  async function carregar() {
    try {
      const { data, error } = await sb.from('k_titles').select('*').eq('ativo', true).order('ordem').order('id', { ascending: false });
      if (error) throw error;
      KM.items = data || []; KM.offline = false; KM.loaded = true; save('km_cache', KM.items);
    } catch (e) {
      KM.items = load('km_cache', []); KM.offline = true; KM.loaded = true;
      KM.erroTabela = /k_titles|schema cache|does not exist/i.test(String(e && e.message));
    }
    try { (await IDB.metas()).forEach(m => KM.dl[m.key] = m); } catch (e) { }
  }
  async function episodios(id) {
    if (KM.eps[id]) return KM.eps[id];
    let l = [];
    try { const { data, error } = await sb.from('k_episodios').select('*').eq('title_id', id).order('temporada').order('numero'); if (error) throw error; l = data || []; save('km_eps_' + id, l); }
    catch (e) { l = load('km_eps_' + id, []); }
    KM.eps[id] = l; return l;
  }

  /* ---------- Internet Archive (filmes completos, domínio público / licença livre) ---------- */
  const IA = 'https://archive.org';
  let iaSeq = 1000000;
  const iaIds = {};   // identifier -> id numérico
  const semHtml = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  function iaItem(d) {
    const idf = d.identifier;
    if (!iaIds[idf]) iaIds[idf] = ++iaSeq;
    const desc = semHtml(Array.isArray(d.description) ? d.description[0] : d.description);
    const lang = [].concat(d.language || []).join(' ').toLowerCase();
    return { id: iaIds[idf], ia: idf, tipo: 'filme', titulo: String(Array.isArray(d.title) ? d.title[0] : d.title || idf).slice(0, 90), sinopse: desc.slice(0, 600), ano: d.year ? +String(d.year).slice(0, 4) || null : null,
      generos: ['Grátis'], idioma: /por|pt/.test(lang) ? 'Português' : (/eng|en/.test(lang) ? 'Inglês' : (lang ? lang.toUpperCase().slice(0, 14) : '')),
      poster_url: IA + '/services/img/' + encodeURIComponent(idf), capa_url: IA + '/services/img/' + encodeURIComponent(idf), video_url: null, legenda_url: null, resolvido: false };
  }
  async function iaBuscar(modo, q) {
    KM.iaBusy = true; if (KM.cat === 'gratis' && open1()) pintar();
    let qs = 'collection:(feature_films) AND mediatype:(movies) AND NOT collection:(adult)';
    if (modo === 'pt') qs += ' AND language:(Portuguese OR por OR pt)';
    if (q) qs += ' AND (title:(' + q.replace(/[()":\\]/g, ' ') + ') OR subject:(' + q.replace(/[()":\\]/g, ' ') + '))';
    try {
      const url = IA + '/advancedsearch.php?q=' + encodeURIComponent(qs) + '&fl[]=identifier&fl[]=title&fl[]=description&fl[]=year&fl[]=language&sort[]=downloads+desc&rows=48&page=1&output=json';
      const r = await fetch(url); if (!r.ok) throw new Error('ia');
      const j = await r.json();
      KM.ia = (j.response.docs || []).map(iaItem); KM.iaErro = false;
      if (!q) save(modo === 'pt' ? 'km_ia_pt' : 'km_ia', KM.ia);
    } catch (e) { KM.iaErro = true; if (!q) KM.ia = load(modo === 'pt' ? 'km_ia_pt' : 'km_ia', []).map(x => { iaIds[x.ia] = x.id; iaSeq = Math.max(iaSeq, x.id); return x; }); else KM.ia = []; }
    KM.iaBusy = false; if (open1()) pintar();
  }
  // descobre o ficheiro de vídeo e a legenda em português deste filme
  async function iaMeta(t) {
    if (t.resolvido) return;
    try {
      const r = await fetch(IA + '/metadata/' + encodeURIComponent(t.ia)); const j = await r.json();
      const F = (j.files || []).filter(f => f.name && !/^__ia_thumb/.test(f.name));
      const vids = F.filter(f => /\.(mp4|m4v)$/i.test(f.name)).sort((a, b) => (+a.size || 9e12) - (+b.size || 9e12));
      const pequeno = vids.find(f => /512kb|_512|\.ia\.mp4$/i.test(f.name)) || vids.find(f => (+f.size || 0) > 20e6 && (+f.size || 0) < 1.5e9) || vids[0];
      const subs = F.filter(f => /\.(vtt|srt)$/i.test(f.name));
      const pt = subs.find(f => /(^|[^a-z])(pt|por|pt-pt|pt-br|portugu)/i.test(f.name));
      const base = IA + '/download/' + encodeURIComponent(t.ia) + '/';
      if (pequeno) t.video_url = base + pequeno.name.split('/').map(encodeURIComponent).join('/');
      if (pt) t.legenda_url = base + pt.name.split('/').map(encodeURIComponent).join('/');
      const m = j.metadata || {};
      if (!t.sinopse && m.description) t.sinopse = semHtml(Array.isArray(m.description) ? m.description[0] : m.description).slice(0, 600);
      if (m.runtime) t.duracao = String(m.runtime).slice(0, 20);
      t.licenca = m.licenseurl || '';
      t.resolvido = true;
    } catch (e) { t.erroMeta = true; }
  }

  /* ---------- ecrã principal ---------- */
  async function abrir() {
    openSheet('sh-movies');
    if (!KM.loaded) { $('kmBody').innerHTML = `<div class="km-empty">A carregar…</div>`; await carregar(); }
    else carregar().then(() => { if (open1()) pintar(); });
    pintar();
    if (!KM.ia.length && !KM.iaBusy) iaBuscar('pop', '');
  }
  const open1 = () => $('sh-movies').classList.contains('open');
  function fechar() { pararPlayer(); closeSheets(); }
  function busca() { KM.busca = !KM.busca; $('kmSb').classList.toggle('on', KM.busca); if (KM.busca) $('kmQ').focus(); else { KM.q = ''; $('kmQ').value = ''; } pintar(); }
  function setCat(c) { KM.cat = c; if (c === 'gratis' && !KM.ia.length) iaBuscar(KM.iaMode, ''); pintar(); $('kmBody').scrollTop = 0; }
  function setQ(v) {
    KM.q = v;
    if (KM.cat === 'gratis') { clearTimeout(KM.iaT); KM.iaT = setTimeout(() => iaBuscar(KM.iaMode, v.trim()), 500); return; }
    pintar(true);
  }
  function iaModo(m) { KM.iaMode = m; KM.q = ''; if ($('kmQ')) $('kmQ').value = ''; iaBuscar(m, ''); }
  const sem = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function card(t, extra) {
    const prog = extra && extra.pct ? `<div class="km-bar"><i style="width:${extra.pct}%"></i></div>` : '';
    const dl = temDl(t) ? `<span class="km-dlb">${SV(IC.ok, 13)}</span>` : '';
    return `<button class="km-card" onclick="KMovies.det(${t.id})" aria-label="${esc(t.titulo)}">${ph(t)}${t.tipo === 'serie' ? '<span class="km-tag">SÉRIE</span>' : ''}${dl}${prog}</div>${t.ia ? `<span class="km-cap">${esc(t.titulo)}</span>` : ''}</button>`;
  }
  const temDl = t => Object.values(KM.dl).some(m => m.titleId === t.id);
  const rail = (titulo, arr, ex) => arr.length ? `<section class="km-row"><h3>${esc(titulo)}</h3><div class="km-rail">${arr.map(t => card(t, ex && ex(t))).join('')}</div></section>` : '';

  function pintar(soLista) {
    const el = $('kmBody');
    const chips = [['inicio', 'Início'], ['filme', 'Filmes'], ['serie', 'Séries'], ['gratis', 'Grátis'], ['lista', 'Minha lista']];
    const ch = `<div class="km-chips ${KM.busca ? 'sb' : ''}">${chips.map(c => `<button class="km-chip ${KM.cat === c[0] ? 'on' : ''}" onclick="KMovies.cat('${c[0]}')">${c[1]}</button>`).join('')}</div>`;
    if (!KM.items.length && !KM.ia.length && !Object.keys(KM.dl).length && KM.cat !== 'gratis') {
      el.innerHTML = ch + `<div class="km-empty">${SV(IC.film, 54)}<b>${KM.erroTabela ? 'Catálogo por configurar' : 'Em breve'}</b>${KM.erroTabela ? 'Falta correr o ficheiro taxi.sql no Supabase.' : 'Ainda não há filmes nem séries. Volte em breve!'}</div>`; return;
    }
    let L = KM.items.slice();
    if (KM.cat === 'filme') L = L.filter(t => t.tipo === 'filme'); else if (KM.cat === 'serie') L = L.filter(t => t.tipo === 'serie');
    const q = sem(KM.q).trim();
    if (q && KM.cat !== 'gratis') {
      const R = KM.items.filter(t => sem(t.titulo + ' ' + (t.generos || []).join(' ') + ' ' + (t.sinopse || '')).includes(q));
      el.innerHTML = ch + (R.length ? `<div class="km-grid">${R.map(t => card(t)).join('')}</div>` : `<div class="km-empty"><b>Nada encontrado</b>Não há resultados para "${esc(KM.q)}".</div>`);
      return;
    }
    let h = ch;
    if (KM.cat === 'gratis') {
      const md = [['pop', 'Populares'], ['pt', 'Em português']];
      h += `<div class="km-chips" style="padding-top:0">${md.map(m => `<button class="km-chip ${KM.iaMode === m[0] ? 'on' : ''}" onclick="KMovies.iaModo('${m[0]}')">${m[1]}</button>`).join('')}</div>`;
      if (KM.iaBusy) h += `<div class="km-empty">A procurar filmes…</div>`;
      else if (KM.ia.length) h += `<div class="km-grid">${KM.ia.map(t => card(t)).join('')}</div>`;
      else h += `<div class="km-empty"><b>${KM.iaErro ? 'Sem ligação' : 'Nada encontrado'}</b>${KM.iaErro ? 'Não foi possível falar com o Internet Archive. Verifique a internet.' : 'Tente outra pesquisa ou o filtro “Populares”.'}</div>`;
      h += `<p class="km-fonte">Filmes de domínio público e licença livre, fornecidos pelo Internet Archive (archive.org). Muitos são clássicos e podem não ter legenda em português.</p>`;
      el.innerHTML = h; return;
    }
    if (KM.cat === 'lista') {
      const fav = KM.items.filter(t => isFav(t.id)), dls = descarregados();
      h += rail('A minha lista', fav) + (dls.length ? `<section class="km-row"><h3>Descarregados · sem internet</h3><div class="km-rail">${dls.map(t => card(t)).join('')}</div></section>` : '');
      if (!fav.length && !dls.length) h += `<div class="km-empty"><b>Lista vazia</b>Toque em “Minha lista” nos filmes que quer ver depois, ou baixe um filme para ver sem internet.</div>`;
      el.innerHTML = h; return;
    }
    if (KM.cat === 'inicio') {
      const dest = L.find(t => t.destaque) || L[0];
      if (dest) {
        const bg = dest.capa_url || dest.poster_url;
        h += `<div class="km-hero" style="${bg ? `background-image:url('${esc(bg)}')` : `background:linear-gradient(160deg,${COR[dest.id % COR.length][0]},#0d0d14)`}"><div class="in"><h2>${esc(dest.titulo)}</h2><div class="km-gen">${[dest.tipo === 'serie' ? 'Série' : 'Filme', ...(dest.generos || []).slice(0, 3)].map(esc).join('<i>•</i>')}</div><div class="km-btns"><button class="km-b p" onclick="KMovies.assistir(${dest.id})">${SV(IC.play, 18)}Assistir</button><button class="km-b" onclick="KMovies.det(${dest.id})">${SV(IC.info, 18)}Detalhes</button></div></div></div>`;
      }
      const cont = continuar();
      h += rail('Continuar a assistir', cont.map(c => c.t), t => ({ pct: cont.find(c => c.t === t).pct }));
      h += rail('Descarregados', descarregados());
      h += rail('Grátis · filmes completos', KM.ia.slice(0, 14));
    }
    if (KM.cat === 'inicio') h += rail('Novidades', L.slice(0, 12));
    const gen = {};
    L.forEach(t => (t.generos || []).forEach(g => (gen[g] = gen[g] || []).push(t)));
    if (KM.cat === 'inicio') { h += rail('Filmes', L.filter(t => t.tipo === 'filme')); h += rail('Séries', L.filter(t => t.tipo === 'serie')); }
    else h += `<div class="km-grid" style="margin-top:6px">${L.map(t => card(t)).join('')}</div>`;
    if (KM.cat === 'inicio') Object.keys(gen).sort().forEach(g => { if (gen[g].length > 1) h += rail(g, gen[g]); });
    if (KM.cat !== 'inicio' && !L.length) h += `<div class="km-empty"><b>Em breve</b>Ainda não há ${KM.cat === 'serie' ? 'séries' : 'filmes'} aqui.</div>`;
    el.innerHTML = h;
  }
  function descarregados() { const ids = [...new Set(Object.values(KM.dl).map(m => m.titleId))]; return ids.map(id => tit(id) || metaTitulo(id)).filter(Boolean); }
  function metaTitulo(id) { const m = Object.values(KM.dl).find(x => x.titleId === id); return m ? m.tituloObj : null; }
  function continuar() {
    return Object.keys(KM.pos).map(k => ({ k, p: KM.pos[k] })).filter(x => x.p.d && x.p.t > 15 && x.p.t < x.p.d - 30).sort((a, b) => b.p.ts - a.p.ts)
      .map(x => ({ t: tit(x.p.titleId), pct: Math.round(x.p.t / x.p.d * 100) })).filter(x => x.t);
  }

  /* ---------- detalhe ---------- */
  const unidadeDe = {};  // key -> info de reprodução/descarga
  async function det(id) {
    const t = tit(id) || metaTitulo(id); if (!t) return;
    KM.cur = t; openSheet('sh-mdet'); $('kmDet').scrollTop = 0;
    $('kmDet').innerHTML = `<div class="km-empty">A carregar…</div>`;
    if (t.tipo === 'serie') await episodios(id);
    if (t.ia) await iaMeta(t);
    if (KM.cur !== t) return;
    pintarDet();
  }
  function infoT(t) { // unidade de um filme
    const key = 't' + t.id;
    unidadeDe[key] = { key, titleId: t.id, titulo: t.titulo, sub: '', video: t.video_url, legenda: t.legenda_url, poster: t.poster_url, tituloObj: t };
    return unidadeDe[key];
  }
  function infoE(t, e) {
    const key = 'e' + e.id;
    unidadeDe[key] = { key, titleId: t.id, epId: e.id, titulo: t.titulo, sub: `T${e.temporada} E${e.numero}${e.titulo ? ' · ' + e.titulo : ''}`, video: e.video_url, legenda: e.legenda_url || t.legenda_url, poster: t.poster_url, tituloObj: t };
    return unidadeDe[key];
  }
  const BTN_DL = key => {
    const p = KM.prog[key], m = KM.dl[key];
    if (m) return `<button class="km-b full" onclick="KMovies.apagar('${key}')">${SV(IC.trash, 18)}Remover download</button>`;
    if (p != null) return `<div><button class="km-b full" onclick="KMovies.cancelarDl('${key}')">${SV(IC.x, 18)}A baixar… <span data-pct="${key}">${p}%</span> · Cancelar</button><div class="km-prog"><i data-bar="${key}" style="width:${p}%"></i></div></div>`;
    return `<button class="km-b full" onclick="KMovies.baixar('${key}')">${SV(IC.down, 18)}Baixar para ver sem internet</button>`;
  };
  function pintarDet() {
    const t = KM.cur; if (!t) return;
    const bg = t.capa_url || t.poster_url;
    const eps = KM.eps[t.id] || [];
    let h = `<div class="km-dhero" style="${bg ? `background-image:url('${esc(bg)}')` : `background:linear-gradient(160deg,${COR[t.id % COR.length][0]},#0d0d14)`}"></div><div class="km-dbody"><h1>${esc(t.titulo)}</h1>
      <div class="km-meta">${t.ano ? `<span>${t.ano}</span>` : ''}${t.classificacao ? `<em>${esc(t.classificacao)}</em>` : ''}${t.duracao ? `<span>${esc(t.duracao)}</span>` : ''}${t.idioma ? `<b>${esc(t.idioma)}</b>` : ''}${t.ia ? (t.legenda_url ? '<span>Legendas em português</span>' : '<span>Sem legenda em português</span>') : '<span>Legendas em português</span>'}</div>`;
    if (t.ia && !t.video_url) h += `<p class="km-syn">${t.erroMeta ? 'Não foi possível obter o vídeo agora. Tente de novo mais tarde.' : 'Vídeo indisponível neste título.'}</p>`;
    else if (t.tipo === 'filme') {
      const u = infoT(t); const p = KM.pos[u.key];
      h += `<div class="km-acts"><button class="km-b p full" onclick="KMovies.tocar('${u.key}')">${SV(IC.play, 20)}${p && p.t > 15 ? 'Continuar' : 'Assistir'}</button>${BTN_DL(u.key)}</div>`;
    } else if (eps.length) {
      const prim = eps[0], u = infoE(t, prim);
      const ult = Object.values(KM.pos).filter(x => x.titleId === t.id).sort((a, b) => b.ts - a.ts)[0];
      const alvo = ult && ult.epId && eps.find(e => e.id === ult.epId) ? eps.find(e => e.id === ult.epId) : prim;
      h += `<div class="km-acts"><button class="km-b p full" onclick="KMovies.tocar('${infoE(t, alvo).key}')">${SV(IC.play, 20)}${ult ? `Continuar T${alvo.temporada} E${alvo.numero}` : 'Assistir T1 E1'}</button></div>`;
    }
    h += `<div class="km-mini"><button onclick="KMovies.lista(${t.id})">${SV(isFav(t.id) ? IC.ok : IC.plus, 24)}Minha lista</button></div>`;
    if (t.sinopse) h += `<p class="km-syn">${esc(t.sinopse)}</p>`;
    if (t.ia) h += `<p class="km-fonte" style="text-align:left;padding:0">Fonte: Internet Archive · domínio público / licença livre${t.licenca ? ' · <a style="color:#9aa" href="' + esc(t.licenca) + '" target="_blank" rel="noopener">licença</a>' : ''}</p>`;
    if (t.generos && t.generos.length && !t.ia) h += `<div class="km-meta">${t.generos.map(esc).join(' • ')}</div>`;
    if (t.tipo === 'serie') {
      const temps = [...new Set(eps.map(e => e.temporada))];
      const ts = KM.temp && temps.includes(KM.temp) ? KM.temp : temps[0];
      KM.temp = ts;
      h += eps.length ? `${temps.length > 1 ? `<select class="km-sel" onchange="KMovies.temp(+this.value)">${temps.map(n => `<option value="${n}" ${n === ts ? 'selected' : ''}>Temporada ${n}</option>`).join('')}</select>` : '<h3 style="margin:14px 0 4px;font-size:16px">Episódios</h3>'}` +
        eps.filter(e => e.temporada === ts).map(e => { const u = infoE(t, e), m = KM.dl[u.key], p = KM.prog[u.key]; return `<div class="km-ep"><span class="n">${e.numero}</span><div class="t"><b>${esc(e.titulo || 'Episódio ' + e.numero)}</b><span>${esc(e.duracao || '')}${m ? ' · descarregado' : ''}</span>${p != null ? `<div class="km-prog"><i data-bar="${u.key}" style="width:${p}%"></i></div>` : ''}</div>
          <button class="db ${m ? 'ok' : ''}" onclick="KMovies.${m ? 'apagar' : p != null ? 'cancelarDl' : 'baixar'}('${u.key}')" aria-label="Baixar">${SV(m ? IC.ok : p != null ? IC.x : IC.down, 20)}</button><button class="pb" onclick="KMovies.tocar('${u.key}')" aria-label="Ver">${SV(IC.play, 16)}</button></div>`; }).join('')
        : `<div class="km-empty" style="padding:30px 0">Os episódios chegam em breve.</div>`;
    }
    $('kmDet').innerHTML = h + '</div>';
  }
  function voltarDet() { openSheet('sh-movies'); pintar(); }
  function lista(id) { const i = KM.lista.indexOf(id); if (i >= 0) KM.lista.splice(i, 1); else KM.lista.push(id); save('km_lista', KM.lista); pintarDet(); toast(isFav(id) ? 'Adicionado à sua lista.' : 'Removido da sua lista.'); }

  /* ---------- download ---------- */
  async function baixar(key) {
    const u = unidadeDe[key]; if (!u || !u.video) return toast('Vídeo indisponível.');
    if (!navigator.onLine) return toast('Precisa de internet para baixar.');
    if (KM.ctl[key]) return;
    if (!window.indexedDB) return toast('Este telemóvel não permite guardar vídeos.');
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
    const ctl = new AbortController(); KM.ctl[key] = ctl; KM.prog[key] = 0; refrescaDet();
    try {
      const r = await fetch(u.video, { signal: ctl.signal });
      if (!r.ok) throw new Error('http ' + r.status);
      const total = +r.headers.get('content-length') || 0;
      const rd = r.body && r.body.getReader ? r.body.getReader() : null;
      let blob;
      if (rd) {
        const parts = []; let got = 0, ult = 0;
        for (; ;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (total) { const p = Math.min(99, Math.floor(got / total * 100)); if (p !== ult) { ult = p; KM.prog[key] = p; progresso(key, p); } } }
        blob = new Blob(parts, { type: r.headers.get('content-type') || 'video/mp4' });
      } else blob = await r.blob();
      let vtt = ''; if (u.legenda) { try { vtt = await legendaTexto(u.legenda); } catch (e) { } }
      let poster = ''; if (u.poster) { try { poster = await new Promise(ok => { const f = new FileReader(); fetch(u.poster).then(x => x.blob()).then(b => { f.onload = () => ok(f.result); f.readAsDataURL(b); }).catch(() => ok('')); }); } catch (e) { } }
      const meta = { key, titleId: u.titleId, epId: u.epId || null, titulo: u.titulo, sub: u.sub, tipo: u.epId ? 'serie' : 'filme', size: blob.size, ts: Date.now(), tituloObj: Object.assign({}, u.tituloObj, { poster_url: poster || u.tituloObj.poster_url }), legenda: !!vtt };
      await IDB.guardar(meta, { blob, vtt });
      KM.dl[key] = meta; toast('Descarregado: ' + u.titulo + (u.sub ? ' · ' + u.sub : ''));
    } catch (e) {
      if (e && e.name === 'AbortError') toast('Download cancelado.');
      else toast(/quota|storage/i.test(String(e && (e.name + e.message))) ? 'Sem espaço no telemóvel para este vídeo.' : 'Não foi possível baixar (verifique a internet).');
    }
    delete KM.prog[key]; delete KM.ctl[key]; refrescaDet(); if (open1()) pintar();
  }
  function cancelarDl(key) { if (KM.ctl[key]) KM.ctl[key].abort(); }
  async function apagar(key) {
    if (!confirm('Remover este vídeo do telemóvel?')) return;
    try { await IDB.apagar(key); } catch (e) { }
    delete KM.dl[key]; refrescaDet(); if (open1()) pintar(); toast('Removido do telemóvel.');
  }
  function progresso(key, p) {
    document.querySelectorAll(`[data-pct="${key}"]`).forEach(e => e.textContent = p + '%');
    document.querySelectorAll(`[data-bar="${key}"]`).forEach(e => e.style.width = p + '%');
  }
  function refrescaDet() { if ($('sh-mdet').classList.contains('open')) { const y = $('kmDet').scrollTop; pintarDet(); $('kmDet').scrollTop = y; } }
  function temp(n) { KM.temp = n; pintarDet(); }

  /* ---------- legendas ---------- */
  async function legendaTexto(url) {
    const r = await fetch(url); if (!r.ok) throw new Error('legenda');
    let t = await r.text();
    if (!/^\s*WEBVTT/.test(t)) t = 'WEBVTT\n\n' + t.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');   // .srt -> .vtt
    return t;
  }

  /* ---------- player ---------- */
  const blobUrl = (b, tipo) => { const u = URL.createObjectURL(b instanceof Blob ? b : new Blob([b], { type: tipo })); KM.urls.push(u); return u; };
  async function tocar(key) {
    const u = unidadeDe[key]; if (!u) return;
    let src = u.video, vtt = '';
    const m = KM.dl[key];
    try {
      if (m) { const f = await IDB.file(key); if (f && f.blob) { src = blobUrl(f.blob); vtt = f.vtt || ''; } }
      else if (u.legenda) { vtt = await legendaTexto(u.legenda).catch(() => ''); }
    } catch (e) { }
    if (!src) return toast('Vídeo indisponível.');
    if (!m && !navigator.onLine) return toast('Sem internet. Veja os vídeos que já baixou em "Minha lista".');
    openSheet('sh-mplay');
    $('kmPT').textContent = u.titulo + (u.sub ? ' · ' + u.sub : '');
    const trk = vtt ? `<track kind="subtitles" srclang="pt" label="Português" default src="${blobUrl(new Blob([vtt], { type: 'text/vtt' }))}">` : '';
    $('kmPW').innerHTML = `<video id="kmV" controls playsinline autoplay preload="auto" controlsList="nodownload">${trk}</video>`;
    const v = $('kmV'); KM.vid = { v, key, u }; v.src = src;
    v.addEventListener('error', () => toast('Não foi possível reproduzir este vídeo.'));
    const p = KM.pos[key];
    v.addEventListener('loadedmetadata', () => { if (p && p.t > 15 && p.t < v.duration - 30) v.currentTime = p.t; try { if (v.textTracks[0]) v.textTracks[0].mode = 'showing'; } catch (e) { } });
    let last = 0;
    v.addEventListener('timeupdate', () => { const n = Date.now(); if (n - last > 5000 && v.duration) { last = n; KM.pos[key] = { t: v.currentTime, d: v.duration, titleId: u.titleId, epId: u.epId || null, ts: n }; save('km_pos', KM.pos); } });
    v.addEventListener('ended', () => { delete KM.pos[key]; save('km_pos', KM.pos); proximo(); });
    $('kmPN').innerHTML = '';
    v.play().catch(() => { });
  }
  function proximo() {
    const c = KM.vid; if (!c || !c.u.epId) return;
    const eps = KM.eps[c.u.titleId] || [], i = eps.findIndex(e => e.id === c.u.epId), n = eps[i + 1];
    if (!n) return;
    const nu = infoE(tit(c.u.titleId) || c.u.tituloObj, n);
    $('kmPN').innerHTML = `<button class="km-b r full" onclick="KMovies.tocar('${nu.key}')">${SV(IC.play, 18)}Próximo episódio · E${n.numero}</button>`;
  }
  function pararPlayer() {
    if (KM.vid) { try { KM.vid.v.pause(); KM.vid.v.removeAttribute('src'); KM.vid.v.load(); } catch (e) { } KM.vid = null; }
    $('kmPW').innerHTML = ''; $('kmPN').innerHTML = '';
    KM.urls.forEach(u => URL.revokeObjectURL(u)); KM.urls = [];
  }
  function fecharPlayer() { pararPlayer(); if (KM.cur && KM.cur.id) { openSheet('sh-mdet'); pintarDet(); } else openSheet('sh-movies'); }
  async function assistir(id) {
    const t = tit(id); if (!t) return;
    if (t.tipo === 'filme') { KM.cur = null; infoT(t); return tocar('t' + id); }
    KM.cur = t; const eps = await episodios(id); if (!eps.length) return det(id);
    const ult = Object.values(KM.pos).filter(x => x.titleId === id).sort((a, b) => b.ts - a.ts)[0];
    const e = (ult && eps.find(x => x.id === ult.epId)) || eps[0];
    tocar(infoE(t, e).key);
  }

  window.KMovies = { iaModo, abrir, fechar, busca, cat: setCat, q: setQ, det, voltarDet, assistir, tocar, baixar, cancelarDl, apagar, lista, temp, fecharPlayer };
})();

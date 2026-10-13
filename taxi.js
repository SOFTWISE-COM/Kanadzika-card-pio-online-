/* =====================================================================
   Kanandzika-Taxi (app do cliente)
   Depende de home.html: sb, user, $, esc, toast, openSheet, closeSheets, setNav, Rastreio, L (Leaflet)
   O preço mostrado aqui é só uma ESTIMATIVA; o valor final é calculado na base de dados (taxi.sql).
   ===================================================================== */
(function () {
  const TARIFA = { moto: { base: 60, meio: 10 }, carro: { base: 150, meio: 25 } };
  const NOMES = { moto: 'Moto', carro: 'Carro' };
  const ATIVOS = ['pendente', 'aceite', 'no_local', 'em_viagem'];
  const rad = d => d * Math.PI / 180;
  const distM = (a, b) => { // igual ao taxi_distancia_m do SQL: linha reta x 1,3
    const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return Math.round(2 * 6371000 * Math.asin(Math.sqrt(x)) * 1.3);
  };
  const preco = (v, m) => { const km = m / 1000, t = TARIFA[v]; const p = km <= 2 ? t.base : t.base + Math.ceil((km - 2) * 2) * t.meio; return Math.round(p / 5) * 5; };
  const km1 = m => (m / 1000).toFixed(1).replace('.', ',') + ' km';
  const SVG = (p, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;vertical-align:-4px">${p}</svg>`;
  const IC = {
    moto: Rastreio.ICO.moto, carro: Rastreio.ICO.carro, pin: Rastreio.ICO.pin,
    tel: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.7 7L3 21l2-5.3A8 8 0 1 1 21 12z"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', ok: '<path d="M5 12l5 5 9-10"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
  };
  const S = { veic: 'moto', o: null, d: null, oTxt: '', dTxt: '', modo: 'd', ride: null, map: null, mk: {}, ch: null, poll: null, busy: false, locBusy: false, rota: null, eta: null };

  /* ---------- HTML do sheet ---------- */
  const sheet = document.createElement('div');
  sheet.className = 'sheet'; sheet.id = 'sh-taxi';
  sheet.innerHTML = `<div class="sh-head"><button class="sh-back" onclick="Taxi.fechar()" aria-label="Voltar"><svg class="ico so"><use href="#i-voltar"/></svg>Voltar</button><h2>Kanandzika-Taxi</h2></div><div class="tx-wrap" id="txBody"></div>`;
  document.querySelector('.app').appendChild(sheet);

  const css = document.createElement('style');
  css.textContent = `
  .tx-wrap{flex:1;display:flex;flex-direction:column;min-height:0}
  .tx-map{height:34%;min-height:170px;width:100%;background:#0a4248;flex:none;position:relative;z-index:0}
  .tx-pan{flex:1;overflow-y:auto;padding:12px 14px calc(16px + var(--sab));scrollbar-width:none}
  .tx-pan::-webkit-scrollbar{display:none}
  .tx-veic{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
  .tx-v{border:1.5px solid #17565c;background:#0a4248;border-radius:16px;padding:12px 8px;text-align:center;color:#fff}
  .tx-v b{display:block;font-size:15px;margin-top:2px}.tx-v span{display:block;font-size:12px;color:var(--muted);margin-top:2px}
  .tx-v.sel{border-color:var(--cyan);background:rgba(0,229,255,.13);color:var(--cyan)}.tx-v.sel span{color:#a8eff7}
  .tx-pt{display:flex;gap:8px;align-items:center;border:1.5px solid #17565c;background:#0a4248;border-radius:14px;padding:10px 12px;margin-bottom:8px;font-size:13px;text-align:left;width:100%;color:#fff}
  .tx-pt.sel{border-color:var(--cyan)}.tx-pt small{display:block;color:var(--muted);font-size:11px}
  .tx-pt div{flex:1;min-width:0}.tx-pt div b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
  .tx-pt .dotc{width:12px;height:12px;border-radius:50%;flex:none}
  .tx-q{display:flex;gap:8px;margin-bottom:8px}
  .tx-q input{flex:1;height:44px;border:1.5px solid #17565c;border-radius:14px;background:rgba(0,20,22,.3);color:#fff;padding:0 12px;font-size:14px;outline:0;min-width:0}
  .tx-q input:focus{border-color:var(--cyan)}
  .tx-q button{width:44px;height:44px;border-radius:14px;background:var(--cyan);color:#00282d;display:grid;place-items:center;border:0;flex:none}
  .tx-res{display:grid;gap:6px;margin-bottom:8px}
  .tx-res button{text-align:left;border:1px solid #15575e;background:#073b41;color:#fff;border-radius:12px;padding:9px 11px;font-size:13px;line-height:1.35}
  .tx-price{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#08727b,#0a4248);border-radius:16px;padding:13px 15px;margin:10px 0}
  .tx-price b{font-size:24px;color:#fff}.tx-price span{font-size:12px;color:#c6e1e3}
  .tx-st{text-align:center;padding:6px 0 2px}.tx-st h3{font-size:19px;color:var(--cyan);margin:6px 0 4px}.tx-st p{font-size:13px;color:var(--muted);line-height:1.45}
  .tx-pulse{width:74px;height:74px;border-radius:50%;margin:6px auto;display:grid;place-items:center;background:rgba(0,229,255,.13);color:var(--cyan);animation:ring 1.8s infinite}
  .tx-drv{display:flex;gap:12px;align-items:center}.tx-drv .av{width:54px;height:54px;border-radius:50%;background:#0d5058;display:grid;place-items:center;color:var(--cyan);flex:none}
  .tx-act{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
  .tx-act a{display:flex;align-items:center;justify-content:center;gap:6px;height:44px;border-radius:13px;border:1.5px solid var(--cyan);color:var(--cyan);text-decoration:none;font-weight:bold;font-size:14px}
  .tx-act a.dis{opacity:.4;pointer-events:none}
  .btn.danger{background:rgba(255,67,87,.12);border:1.5px solid #ff4357;color:#ff8c99;margin-top:8px;height:44px;font-size:14px}
  .tx-chip{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:500;background:#fff;color:#0b2a2e;border-radius:16px;padding:6px 13px;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.4);white-space:nowrap}
  `;
  document.head.appendChild(css);

  const body = () => $('txBody');
  const meuId = () => 'tx' + (user && user.phone);

  /* ---------- abrir / fechar ---------- */
  async function abrir() {
    openSheet('sh-taxi'); setNav('Início');
    paint();
    await retomar();
  }
  function fechar() { pararLive(); closeSheets(); }

  // procura uma corrida ativa (ou a última concluída recentemente) para retomar
  async function retomar() {
    try {
      const { data, error } = await sb.from('rides').select('*').order('created_at', { ascending: false }).limit(1);
      if (error) { if (/rides|schema cache|does not exist/i.test(error.message)) { aviso('Falta correr o ficheiro taxi.sql no Supabase.'); } return; }
      const r = data && data[0];
      if (r && ATIVOS.includes(r.estado)) { S.ride = r; paint(); aoVivo(); }
      else if (r && r.estado === 'concluida' && !load('tx_visto_' + r.id, false) && Date.now() - new Date(r.concluida_em).getTime() < 6 * 3600e3) { S.ride = r; paint(); }
    } catch (e) { }
  }
  function aviso(m) { toast(m); }

  /* ---------- tempo real ---------- */
  function aoVivo() {
    pararLive();
    if (!S.ride) return;
    const id = S.ride.id;
    S.ch = sb.channel('taxi-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: 'id=eq.' + id }, p => aplicar(p.new))
      .subscribe();
    S.poll = setInterval(async () => { // segurança caso o tempo real falhe
      const { data } = await sb.from('rides').select('*').eq('id', id).maybeSingle();
      if (data) aplicar(data);
    }, 8000);
  }
  function pararLive() {
    if (S.ch) { sb.removeChannel(S.ch); S.ch = null; }
    clearInterval(S.poll); S.poll = null;
  }
  function aplicar(r) {
    if (!r || !S.ride || r.id !== S.ride.id) return;
    const antes = S.ride.estado;
    S.ride = r;
    if (antes !== r.estado) {
      if (r.estado === 'aceite') { toast('Motorista a caminho!'); try { navigator.vibrate && navigator.vibrate([150, 80, 150]); } catch (e) { } }
      if (r.estado === 'no_local') toast('O motorista chegou ao local de partida.');
      if (r.estado === 'concluida') { toast('Viagem concluída.'); pararLive(); }
      if (r.estado === 'cancelada') { pararLive(); }
      paint(); return;
    }
    if (document.getElementById('sh-taxi').classList.contains('open')) pinta_mapa_ativo();
  }

  /* ---------- localização e pesquisa ---------- */
  function minhaLoc() {
    if (!navigator.geolocation) { toast('Este telemóvel não permite localização.'); return; }
    if (S.locBusy) return; S.locBusy = true;
    navigator.geolocation.getCurrentPosition(p => {
      S.locBusy = false; S.o = { lat: p.coords.latitude, lng: p.coords.longitude }; S.oTxt = 'A minha localização';
      pinta_mapa_form(true); atualizaForm();
    }, () => { S.locBusy = false; toast('Ative a localização do telemóvel ou toque no mapa para marcar a partida.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  }
  async function pesquisar() {
    const q = ($('txQ') || {}).value || '';
    if (q.trim().length < 3) { toast('Escreva pelo menos 3 letras.'); return; }
    const box = $('txRes'); box.innerHTML = '<div class="muted" style="padding:6px">A pesquisar…</div>';
    try {
      const near = S.o || Rastreio.LOJA;
      const vb = [near.lng - 0.4, near.lat + 0.4, near.lng + 0.4, near.lat - 0.4].join(',');
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=pt&countrycodes=mz&viewbox=' + vb + '&q=' + encodeURIComponent(q));
      const j = await r.json();
      if (!j.length) { box.innerHTML = '<div class="muted" style="padding:6px">Nada encontrado. Toque no mapa para marcar o destino.</div>'; return; }
      S._res = j.map(x => ({ lat: +x.lat, lng: +x.lon, txt: String(x.display_name).split(',').slice(0, 3).join(',') }));
      box.innerHTML = S._res.map((x, i) => `<button onclick="Taxi.escolher(${i})">${SVG(IC.pin, 16)} ${esc(x.txt)}</button>`).join('');
    } catch (e) { box.innerHTML = '<div class="muted" style="padding:6px">Sem ligação para pesquisar. Toque no mapa para marcar o destino.</div>'; }
  }
  function escolher(i) {
    const x = S._res && S._res[i]; if (!x) return;
    definir(S.modo, { lat: x.lat, lng: x.lng }, x.txt); $('txRes').innerHTML = '';
  }
  function definir(modo, p, txt) {
    if (modo === 'o') { S.o = p; S.oTxt = txt || 'Ponto no mapa'; } else { S.d = p; S.dTxt = txt || 'Ponto no mapa'; }
    pinta_mapa_form(true); atualizaForm();
  }
  function modo(m) { S.modo = m; atualizaForm(); }
  function veiculo(v) { S.veic = v; atualizaForm(); }

  /* ---------- mapa ---------- */
  function garanteMapa() {
    const el = $('txMap'); if (!el) return false;
    if (S.map && S.map._container !== el) { try { S.map.remove(); } catch (e) { } S.map = null; S.mk = {}; }
    if (!S.map) {
      S.map = Rastreio.mapa('txMap'); S.mk = {};
      S.map.on('click', e => { if (S.ride) return; definir(S.modo, { lat: e.latlng.lat, lng: e.latlng.lng }, 'Ponto marcado no mapa'); });
    }
    setTimeout(() => S.map && S.map.invalidateSize(), 120);
    return true;
  }
  const pino = (cor, letra) => L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 34], html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${cor};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.45);display:grid;place-items:center"><b style="transform:rotate(45deg);color:#fff;font:700 13px Arial">${letra}</b></div>` });
  function mk(k, p, icon) {
    if (!p) { if (S.mk[k]) { S.mk[k].remove(); delete S.mk[k]; } return; }
    if (S.mk[k]) S.mk[k].setLatLng([p.lat, p.lng]); else S.mk[k] = L.marker([p.lat, p.lng], { icon }).addTo(S.map);
  }
  function pinta_mapa_form(enquadra) {
    if (!garanteMapa()) return;
    mk('o', S.o, pino('#00a8c0', 'A')); mk('d', S.d, pino('#ff4357', 'B'));
    if (S.rota) { S.rota.remove(); S.rota = null; }
    if (S.o && S.d) S.rota = L.polyline([[S.o.lat, S.o.lng], [S.d.lat, S.d.lng]], { color: '#00e5ff', weight: 4, dashArray: '6 8' }).addTo(S.map);
    if (enquadra) Rastreio.enquadrar(S.map, [S.o, S.d], true);
  }
  let _etaT = 0;
  async function pinta_mapa_ativo() {
    if (!garanteMapa() || !S.ride) return;
    const r = S.ride, o = { lat: r.o_lat, lng: r.o_lng }, d = { lat: r.d_lat, lng: r.d_lng };
    const drv = r.driver_lat != null ? { lat: r.driver_lat, lng: r.driver_lng } : null;
    mk('o', r.estado === 'em_viagem' ? null : o, pino('#00a8c0', 'A')); mk('d', d, pino('#ff4357', 'B'));
    if (drv) mk('drv', drv, Rastreio.pin('drv:' + r.veiculo)); else mk('drv', null);
    Rastreio.enquadrar(S.map, [drv, r.estado === 'em_viagem' ? d : o, d].filter(Boolean), !S.fitDone);
    S.fitDone = true;
    // tempo estimado até ao ponto de partida / destino
    if (drv && (r.estado === 'aceite' || r.estado === 'em_viagem') && Date.now() - _etaT > 12000) {
      _etaT = Date.now();
      const alvo = r.estado === 'aceite' ? o : d;
      const e = await Rastreio.eta(drv, alvo);
      const t = $('txEta');
      if (t && S.ride && S.ride.id === r.id && S.ride.estado === r.estado) t.textContent = Rastreio.fmtMin(e.segundos) + ' · ' + Rastreio.fmtDist(e.metros) + (r.estado === 'aceite' ? ' até si' : ' até ao destino');
    }
  }

  /* ---------- pedir / cancelar ---------- */
  async function pedir() {
    if (S.busy) return;
    if (!S.o) return toast('Defina o ponto de partida (A).');
    if (!S.d) return toast('Defina o destino (B).');
    const dm = distM(S.o, S.d);
    if (dm < 300) return toast('O destino está muito perto. Escolha outro ponto.');
    if (dm > 60000) return toast('Destino demasiado longe (máx. 60 km).');
    S.busy = true; atualizaForm();
    const { data, error } = await sb.rpc('taxi_pedir', {
      p_veiculo: S.veic, p_o_lat: S.o.lat, p_o_lng: S.o.lng, p_o_txt: S.oTxt, p_d_lat: S.d.lat, p_d_lng: S.d.lng, p_d_txt: S.dTxt,
      p_nome: user.name, p_tel: String(user.phone)
    });
    S.busy = false;
    if (error) { atualizaForm(); return toast(/taxi_pedir|schema cache|does not exist/i.test(error.message) ? 'Falta correr o ficheiro taxi.sql no Supabase.' : 'Erro: ' + error.message); }
    if (!data || !data.ok) {
      atualizaForm();
      const m = { ja_ativa: 'Já tem uma corrida em curso.', muito_perto: 'O destino está muito perto.', muito_longe: 'Destino demasiado longe.', dados: 'Faltam o nome e o telefone do cadastro.' }[data && data.erro] || 'Não foi possível pedir o táxi.';
      if (data && data.erro === 'ja_ativa') retomar();
      return toast(m);
    }
    try { fetch('/api/novo-taxi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track_id: data.track_id }), keepalive: true }).catch(() => { }); } catch (e) { }
    const { data: r } = await sb.from('rides').select('*').eq('id', data.id).maybeSingle();
    S.ride = r; S.fitDone = false; paint(); aoVivo();
  }
  async function cancelar() {
    if (!S.ride) return;
    if (!confirm('Cancelar esta corrida?')) return;
    const { data, error } = await sb.rpc('taxi_cancelar', { p_id: S.ride.id });
    if (error || !data || !data.ok) return toast('Não foi possível cancelar agora.');
    pararLive(); S.ride = null; S.fitDone = false; toast('Corrida cancelada.'); paint();
  }
  function nova() { if (S.ride) save('tx_visto_' + S.ride.id, true); S.ride = null; S.d = null; S.dTxt = ''; S.fitDone = false; paint(); }

  /* ---------- ecrãs ---------- */
  function paint() {
    const el = body(); if (!el) return;
    if (!S.ride) { renderForm(); return; }
    const r = S.ride;
    if (r.estado === 'concluida') { renderFim(r); return; }
    renderAtiva(r);
  }
  function renderForm() {
    body().innerHTML = `<div class="tx-map" id="txMap"></div><div class="tx-pan" id="txPan"></div>`;
    S.map = null; S.mk = {}; S.rota = null;
    atualizaForm(); garanteMapa();
    if (!S.o) minhaLoc(); else pinta_mapa_form(true);
  }
  function atualizaForm() {
    const p = $('txPan'); if (!p || S.ride) return;
    const dm = S.o && S.d ? distM(S.o, S.d) : 0;
    const val = v => dm ? preco(v, dm) : null;
    const pv = S.veic, total = val(pv);
    const keepQ = ($('txQ') || {}).value || '', keepR = $('txRes') ? $('txRes').innerHTML : '';
    p.innerHTML = `
    <div class="tx-veic">
      ${['moto', 'carro'].map(v => `<button class="tx-v ${pv === v ? 'sel' : ''}" onclick="Taxi.veiculo('${v}')">${SVG(IC[v], 30)}<b>${NOMES[v]}</b><span>${val(v) ? val(v) + ' MT' : 'desde ' + TARIFA[v].base + ' MT'}</span></button>`).join('')}
    </div>
    <button class="tx-pt ${S.modo === 'o' ? 'sel' : ''}" onclick="Taxi.modo('o')"><span class="dotc" style="background:#00a8c0"></span><div><small>Partida (A)</small><b>${esc(S.oTxt || 'Toque para marcar no mapa')}</b></div><span class="muted" onclick="event.stopPropagation();Taxi.minhaLoc()" style="color:var(--cyan);font-weight:bold">${SVG(IC.pin, 18)} GPS</span></button>
    <button class="tx-pt ${S.modo === 'd' ? 'sel' : ''}" onclick="Taxi.modo('d')"><span class="dotc" style="background:#ff4357"></span><div><small>Destino (B)</small><b>${esc(S.dTxt || 'Pesquise ou toque no mapa')}</b></div></button>
    <div class="tx-q"><input id="txQ" placeholder="Pesquisar ${S.modo === 'o' ? 'partida' : 'destino'} (ex.: Escola Secundária de Boane)" enterkeyhint="search" onkeydown="if(event.key==='Enter'){event.preventDefault();Taxi.pesquisar()}"><button onclick="Taxi.pesquisar()" aria-label="Pesquisar">${SVG(IC.busca, 20)}</button></div>
    <div class="tx-res" id="txRes">${keepR}</div>
    ${total ? `<div class="tx-price"><div><span>${NOMES[pv]} · ${km1(dm)} aprox.</span><br><span>Pague ao motorista no fim da viagem</span></div><b>${total} MT</b></div>` : `<div class="muted" style="text-align:center;margin:8px 0">Defina partida e destino para ver o preço.</div>`}
    <button class="btn" id="txGo" onclick="Taxi.pedir()" ${S.busy ? 'disabled' : ''}>${SVG(IC[pv], 22)}${S.busy ? 'A pedir…' : 'Pedir Kanandzika-Taxi'}</button>`;
    const q = $('txQ'); if (q) q.value = keepQ;
  }
  const tel9 = p => String(p || '').replace(/\D/g, '').slice(-9);
  function renderAtiva(r) {
    const e = r.estado, d9 = tel9(r.driver_tel);
    const T = {
      pendente: ['A procurar motorista…', `A avisar os motoristas de ${NOMES[r.veiculo].toLowerCase()} perto de si. Normalmente demora poucos minutos.`],
      aceite: ['Motorista a caminho', 'Aguarde no local de partida.'],
      no_local: ['O motorista chegou!', 'Dirija-se ao veículo.'],
      em_viagem: ['Viagem em curso', 'Boa viagem! Pague ao motorista no destino.'],
      cancelada: ['Corrida cancelada', '']
    }[e] || ['', ''];
    body().innerHTML = `<div class="tx-map" id="txMap"><div class="tx-chip" id="txEta" style="display:${e === 'aceite' || e === 'em_viagem' ? 'block' : 'none'}">A calcular…</div></div>
    <div class="tx-pan">
      <div class="tx-st">${e === 'pendente' ? `<div class="tx-pulse">${SVG(IC[r.veiculo], 38)}</div>` : ''}<h3>${T[0]}</h3><p>${T[1]}</p></div>
      ${e !== 'pendente' && e !== 'cancelada' ? `<div class="card tx-drv" style="margin-top:12px"><div class="av">${SVG(IC[r.veiculo], 28)}</div><div style="flex:1;min-width:0"><b style="font-size:15px">${esc(r.driver_nome || 'Motorista')}</b><div class="muted">${esc(r.driver_veiculo || NOMES[r.veiculo])}${r.driver_placa ? ' · <b style="color:#fff">' + esc(r.driver_placa) + '</b>' : ''}</div></div></div>
      <div class="tx-act"><a href="tel:+258${d9}" class="${d9 ? '' : 'dis'}">${SVG(IC.tel, 18)}Ligar</a><a href="https://wa.me/258${d9}" target="_blank" rel="noopener" class="${d9 ? '' : 'dis'}">${SVG(IC.chat, 18)}WhatsApp</a></div>` : ''}
      <div class="card" style="margin-top:12px">
        <div class="row"><span>${SVG(IC.pin, 16)} Partida</span><span>${esc(r.o_txt || '—')}</span></div>
        <div class="row"><span>${SVG(IC.flag, 16)} Destino</span><span>${esc(r.d_txt || '—')}</span></div>
        <div class="row"><span>Distância</span><span>${km1(r.dist_m)}</span></div>
        <div class="row total"><span>Preço (${NOMES[r.veiculo]})</span><span>${r.preco} MT</span></div>
      </div>
      ${e === 'cancelada' ? `<button class="btn" onclick="Taxi.nova()">Nova corrida</button>` : e !== 'em_viagem' ? `<button class="btn danger" onclick="Taxi.cancelar()">Cancelar corrida</button>` : ''}
    </div>`;
    S.map = null; S.mk = {}; S.fitDone = false; _etaT = 0;
    garanteMapa(); pinta_mapa_ativo();
  }
  function renderFim(r) {
    body().innerHTML = `<div class="tx-pan" style="padding-top:30px"><div class="tx-st"><div class="tx-pulse" style="animation:none;background:rgba(34,197,94,.15);color:#22c55e">${SVG(IC.ok, 40)}</div><h3>Chegou ao destino!</h3><p>Pague <b style="color:#fff">${r.preco} MT</b> ao motorista. Obrigado por viajar com a Kanandzika.</p></div>
    <div class="card" style="margin-top:14px"><div class="row"><span>Motorista</span><span>${esc(r.driver_nome || '—')}</span></div><div class="row"><span>Veículo</span><span>${NOMES[r.veiculo]}${r.driver_placa ? ' · ' + esc(r.driver_placa) : ''}</span></div><div class="row"><span>Distância</span><span>${km1(r.dist_m)}</span></div><div class="row total"><span>Total</span><span>${r.preco} MT</span></div></div>
    <button class="btn" onclick="Taxi.nova()">Nova corrida</button></div>`;
  }

  window.Taxi = { abrir, fechar, pedir, cancelar, nova, modo, veiculo, minhaLoc, pesquisar, escolher };
  // quando o sheet abre por outras vias, redimensiona o mapa
  const _os = window.openSheet;
  window.openSheet = function (id) { _os(id); if (id === 'sh-taxi' && S.map) setTimeout(() => S.map.invalidateSize(), 350); };
})();

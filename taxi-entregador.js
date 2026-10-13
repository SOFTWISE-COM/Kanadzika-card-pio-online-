/* =====================================================================
   Kanandzika-Taxi - app do entregador (aba "Taxi")
   Mostra as corridas pedidas pelos clientes para o MESMO tipo de veículo do entregador
   (moto vê corridas de moto, carro vê corridas de carro), o ganho já sem comissão,
   e guia a corrida: aceitar -> cheguei -> iniciar viagem -> concluir.
   Depende de entregador.html: S, sb, I, $, esc, mt, toast, bip, vibra, d2, tel9, first, deslizador, notificar, semSaldo
   ===================================================================== */
(function () {
  const ATIVAS_T = ['aceite', 'no_local', 'em_viagem'];
  const T = { lista: [], mine: null, seen: null, busy: false, last: 0 };
  const veic = () => { const v = String((S.drv && S.drv.vehicle) || '').trim().toLowerCase(); return v === 'moto' ? 'moto' : v === 'carro' ? 'carro' : null; };
  const NOME = { moto: 'Moto', carro: 'Carro' };
  const km1 = m => (m / 1000).toFixed(1).replace('.', ',') + ' km';
  const ganho = r => Number(r.preco) - Number(r.comissao);

  async function refresh(primeira) {
    if (!S.drv || S.drv.status !== 'aprovado') return;
    const v = veic();
    if (!v) { T.lista = []; T.mine = null; paint(); return; }
    const desde = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const [a, m] = await Promise.all([
      sb.from('rides').select('*').eq('estado', 'pendente').eq('veiculo', v).gte('created_at', desde).order('created_at', { ascending: true }).limit(20),
      sb.from('rides').select('*').eq('driver_id', S.uid).in('estado', ATIVAS_T).order('aceite_em', { ascending: false }).limit(1)
    ]);
    if (a.error || m.error) { T.erro = (a.error || m.error).message; if (S.tab === 'taxi') paint(); return; }
    T.erro = null;
    T.lista = a.data || []; T.mine = (m.data || [])[0] || null;
    if (!T.seen) T.seen = new Set(T.lista.map(r => r.id));
    else if (S.online && !T.mine) {
      const novos = T.lista.filter(r => !T.seen.has(r.id));
      novos.forEach(r => T.seen.add(r.id));
      if (novos.length && perto(novos[0])) alerta(novos[0]);
    } else T.lista.forEach(r => T.seen.add(r.id));
    badge(); paint();
    if (T.mine && S.gps == null) iniciarGps(true);
  }
  const perto = r => !S.pos || d2(S.pos, { lat: r.o_lat, lng: r.o_lng }) <= 8000;
  function alerta(r) {
    bip(); vibra([300, 120, 300, 120, 300]);
    toast(`Kanandzika-Taxi: corrida de ${km1(r.dist_m)} · ganha ${mt(ganho(r))} MT`, 6000);
    notificar('Kanandzika-Taxi: nova corrida!', `${NOME[r.veiculo]} · ${km1(r.dist_m)} · ganha ${mt(ganho(r))} MT`, 'kz-taxi-' + r.id);
  }
  function badge() {
    const b = $('bdT'); if (!b) return;
    const n = T.mine ? 1 : (S.online ? T.lista.length : 0);
    b.textContent = n > 9 ? '9+' : n; b.classList.toggle('hidden', !n);
  }

  /* ---------- posição durante a corrida ---------- */
  let pingT = 0;
  function ping() {
    if (!T.mine || !S.pos) return;
    const n = Date.now(); if (n - pingT < 4000) return; pingT = n;
    sb.rpc('taxi_ping', { p_lat: S.pos.lat, p_lng: S.pos.lng }).then(() => { });
    if (S.tab === 'taxi') liveTexto();
  }

  /* ---------- ecrã ---------- */
  function paint() {
    const el = $('v-taxi'); if (!el || S.tab !== 'taxi') return;
    if (S.drag) return;           // não redesenha enquanto o deslizador está a ser arrastado
    const v = veic();
    if (!v) { el.innerHTML = vazio('Só para Moto e Carro', 'O Kanandzika-Taxi leva passageiros em moto ou carro. Para receber corridas, o seu meio de transporte tem de ser Moto ou Carro.'); return; }
    if (T.erro) { el.innerHTML = vazio('Taxi por configurar', /rides|schema cache|does not exist/i.test(T.erro) ? 'Falta correr o ficheiro taxi.sql no Supabase (SQL Editor).' : esc(T.erro)); return; }
    if (T.mine) { el.innerHTML = ativa(T.mine); const h = $('txSl'); if (h) monta(T.mine); liveTexto(); return; }
    let h = `<div class="tx-hd">${I(v, 'l')}<div><b>Kanandzika-Taxi · ${NOME[v]}</b><span>${S.online ? 'Online · a ver corridas de ' + NOME[v].toLowerCase() : 'Fique online para aceitar corridas'}</span></div></div>`;
    if (!S.online) h += `<div class="go"><button class="btn off" onclick="toggleOnline()">${I(semSaldo() ? 'lock' : 'power')}${semSaldo() ? 'Sem saldo · carregue para trabalhar' : 'Ficar online'}</button></div>`;
    const L = S.online ? T.lista : [];
    if (!L.length) h += vazio(S.online ? 'Sem corridas por agora' : 'Está offline', S.online ? 'Assim que um cliente pedir um Kanandzika-Taxi, a corrida aparece aqui e recebe um aviso.' : 'Fique online para ver os pedidos de táxi.');
    else h += L.map(card).join('');
    h += `<p class="hint" style="margin-top:14px">O cliente paga o valor da corrida a si, em mão. A plataforma desconta a comissão (10 %, mín. 10 MT) do seu saldo ao concluir.</p>`;
    el.innerHTML = h;
  }
  const vazio = (t, s) => `<div class="empty" style="padding:34px 16px"><b style="display:block;font-size:16px;color:var(--text);margin-bottom:6px">${t}</b>${s}</div>`;
  function card(r) {
    const dist = S.pos ? d2(S.pos, { lat: r.o_lat, lng: r.o_lng }) : null;
    return `<div class="box tx-c"><div class="tx-top"><span class="tx-price num">${mt(r.preco)}<small> MT</small></span><span class="tx-gain">ganha <b class="num">${mt(ganho(r))} MT</b></span></div>
    <div class="tx-l">${I('pin', 's')}<span><small>Partida</small>${esc(r.o_txt || '—')}${dist != null ? ` <em>(${km1(dist * 1.3)} de si)</em>` : ''}</span></div>
    <div class="tx-l">${I('route', 's')}<span><small>Destino · viagem de ${km1(r.dist_m)}</small>${esc(r.d_txt || '—')}</span></div>
    <div class="tx-l">${I('user', 's')}<span><small>Passageiro</small>${esc(first(r.nome))}</span></div>
    <button class="btn" style="margin-top:10px" onclick="Taxi.aceitar(${r.id})">${I('check')}Aceitar corrida</button></div>`;
  }
  const IDX = { aceite: 0, no_local: 1, em_viagem: 2 };
  function ativa(r) {
    const e = r.estado, i = IDX[e], t9 = tel9(r.tel);
    const nodes = [['Aceite', 'check'], ['No local', 'pin'], ['Em viagem', veic()], ['Destino', 'casa']].map((n, k) => `<div class="n ${k < i ? 'd' : k === i ? 'c' : ''}"><i>${k < i ? I('check') : I(n[1])}</i>${n[0]}</div>`).join('');
    const tit = { aceite: 'Vá buscar ' + first(r.nome), no_local: 'À espera de ' + first(r.nome), em_viagem: 'Leve ' + first(r.nome) + ' ao destino' }[e];
    const alvo = e === 'em_viagem' ? { lat: r.d_lat, lng: r.d_lng } : { lat: r.o_lat, lng: r.o_lng };
    const nav = `https://www.google.com/maps/dir/?api=1&destination=${alvo.lat},${alvo.lng}&travelmode=driving`;
    const sub = { aceite: 'Faltam <b class="num" data-tx="dist">…</b> até ao passageiro.', no_local: 'Quando o passageiro entrar, deslize para iniciar a viagem.', em_viagem: 'Faltam <b class="num" data-tx="dist">…</b> até ao destino.' }[e];
    return `<div class="box tx-c"><div class="sh-t">${esc(tit)}</div><p class="sh-s">${sub}</p>
    <div class="rib" style="--p:${i / 3}">${nodes}</div>
    <div class="mini-a"><a href="tel:+258${t9}" class="${t9 ? '' : 'dis'}">${I('phone', 's')}Ligar</a><a href="https://wa.me/258${t9}" target="_blank" rel="noopener" class="${t9 ? '' : 'dis'}">${I('chat', 's')}WhatsApp</a><a href="${nav}" target="_blank" rel="noopener">${I('nav', 's')}Navegar</a></div>
    <div class="itl"><div><span>Partida</span><span>${esc(r.o_txt || '—')}</span></div><div><span>Destino</span><span>${esc(r.d_txt || '—')}</span></div><div><span>Distância</span><span class="num">${km1(r.dist_m)}</span></div><div><span>Cobrar ao passageiro</span><span class="num">${mt(r.preco)} MT</span></div><div class="tt"><span>O seu ganho</span><span class="num">${mt(ganho(r))} MT</span></div></div>
    <div id="txSl"></div>
    ${e !== 'em_viagem' ? `<button class="link" style="width:100%" onclick="Taxi.libertar()">Não consigo fazer esta corrida</button>` : ''}</div>`;
  }
  function monta(r) {
    const cfg = { aceite: ['Deslize: cheguei ao local', 'no_local'], no_local: ['Deslize: iniciar viagem', 'iniciar'], em_viagem: ['Deslize: cheguei ao destino', 'concluir'] }[r.estado];
    if (cfg) deslizador($('txSl'), cfg[0], () => etapa(r.id, cfg[1]));
  }
  function liveTexto() {
    const r = T.mine; if (!r || !S.pos) return;
    const alvo = r.estado === 'em_viagem' ? { lat: r.d_lat, lng: r.d_lng } : { lat: r.o_lat, lng: r.o_lng };
    document.querySelectorAll('[data-tx="dist"]').forEach(e => e.textContent = Rastreio.fmtDist(d2(S.pos, alvo) * 1.3));
  }

  /* ---------- ações ---------- */
  async function aceitar(id) {
    if (T.busy) return; T.busy = true;
    if (semSaldo()) { T.busy = false; toast('Sem saldo para a comissão. Carregue o saldo.', 4500); return abrirCarteira(); }
    if (S.mine) { T.busy = false; return toast('Termine a entrega em curso primeiro.'); }
    const { data, error } = await sb.rpc('taxi_aceitar', { p_id: id });
    T.busy = false;
    if (error) return toast('Erro: ' + error.message);
    if (!data || !data.ok) {
      toast({ indisponivel: 'Outro motorista já aceitou esta corrida.', ja_ativa: 'Já tem uma tarefa em curso.', veiculo: 'Esta corrida é para outro tipo de veículo.', sem_saldo: 'Sem saldo para a comissão. Carregue o saldo.' }[data && data.erro] || 'Não foi possível aceitar.', 4500);
      return refresh();
    }
    toast('Corrida aceite! Vá buscar o passageiro.'); vibra([100, 60, 100]);
    iniciarGps(true); await refresh();
  }
  async function etapa(id, e) {
    const { data, error } = await sb.rpc('taxi_etapa', { p_id: id, p_etapa: e });
    if (error || !data || !data.ok) { toast('Não foi possível atualizar a corrida.'); return refresh(); }
    if (e === 'concluir') {
      const g = T.mine ? ganho(T.mine) : 0; toast('Corrida concluída! Ganhou ' + mt(g) + ' MT (cobre ' + mt(T.mine ? T.mine.preco : 0) + ' MT ao passageiro).', 7000); vibra([200, 100, 200]);
      T.mine = null; if (typeof carregarWallet === 'function') carregarWallet(true);
    }
    await refresh();
  }
  async function libertar() {
    if (!T.mine || !confirm('Devolver esta corrida para outro motorista?')) return;
    const { data } = await sb.rpc('taxi_etapa', { p_id: T.mine.id, p_etapa: 'libertar' });
    if (data && data.ok) { toast('Corrida devolvida.'); T.mine = null; } else toast('Não foi possível devolver agora.');
    refresh();
  }

  window.Taxi = { refresh, paint, ping, aceitar, libertar, badge, ativa: () => T.mine };
})();

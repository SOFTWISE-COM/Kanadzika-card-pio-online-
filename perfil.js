/* Perfil, sub-ecrãs (endereços, pagamento, notificações, ajuda, sobre) e confirmações de saída.
   Carregado depois do script principal de home.html (usa $, load, save, user, toast, esc, BAIRROS, state, openSheet...). */
(function () {
  const APP = document.querySelector('.app');
  const U = (n, c) => '<svg class="ico' + (c ? ' ' + c : '') + '"><use href="#i-' + n + '"/></svg>';
  const TEL = '+258847923879';

  /* ---------- estilos ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .psub,#sh-profile{background:#f4f7f6;color:#1c2b2b}
  .psub .sh-head,#sh-profile .sh-head{background:#fff;border-bottom:1px solid #e6ecea;padding:calc(12px + env(safe-area-inset-top)) 14px 12px;color:#1c2b2b}
  .psub .sh-back,#sh-profile .sh-back{background:#f0f4f3;border:0;color:#1c2b2b}
  .psub .sh-head h2,#sh-profile .sh-head h2{font-size:18px;font-weight:700;color:#1c2b2b;display:flex;align-items:center}
  .psub .sh-body,#sh-profile .sh-body{padding:16px 16px 40px}
  .pcard{background:#fff;border-radius:18px;padding:16px;box-shadow:0 4px 18px rgba(0,0,0,.06);margin-bottom:14px}
  .pcard h4{margin:0 0 4px;font-size:15px}.pmut{color:#6b7b7a;font-size:13px;line-height:1.45}
  .pbtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:14px;height:46px;padding:0 18px;font-weight:700;font-size:14px;background:#00a86b;color:#fff;text-decoration:none;font-family:inherit}
  .pbtn.sec{background:#e5f7ef;color:#008b59}.pbtn.red{background:#fff0f1;color:#d94b59}.pbtn.full{width:100%}
  .pbtn .ico{margin:0}
  .u-card{display:flex;align-items:center;gap:14px}
  .u-av{width:68px;height:68px;border-radius:50%;background:#e3f7ef;color:#00a86b;display:grid;place-items:center;overflow:hidden;flex:none}
  .u-av img{width:100%;height:100%;object-fit:cover}.u-av .ico{width:32px;height:32px;margin:0}
  .u-i{flex:1;min-width:0}.u-i strong{display:block;font-size:17px;margin-bottom:4px;word-break:break-word}.u-i span{display:block;color:#6b7b7a;font-size:13px}
  .p-ban{background:linear-gradient(135deg,#0f9d58,#075b3e);color:#fff;border-radius:18px;padding:16px;display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .p-ban .bi{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;flex:none}.p-ban .bi .ico{margin:0;width:24px;height:24px}
  .p-ban div.t{flex:1}.p-ban strong{display:block;font-size:15px;margin-bottom:3px}.p-ban span{font-size:12px;opacity:.92}
  .p-ban .pbtn{background:#fff;color:#075b3e;height:38px;padding:0 12px;font-size:13px}
  .p-menu{background:#fff;border-radius:18px;box-shadow:0 4px 18px rgba(0,0,0,.06);overflow:hidden}
  .p-it{width:100%;border:0;background:#fff;display:flex;align-items:center;padding:14px 16px;text-align:left;border-bottom:1px solid #eef2f1;color:#1c2b2b;font-family:inherit;font-size:14px;font-weight:600;gap:13px}
  .p-it:last-child{border-bottom:0}
  .p-ic{width:42px;height:42px;border-radius:50%;background:#e9f8f2;color:#00a86b;display:grid;place-items:center;flex:none}.p-ic .ico{margin:0;width:20px;height:20px}
  .p-it .tx{flex:1}.p-it .ch{color:#aab6b5;display:flex}.p-it .ch .ico{margin:0}
  .p-bd{min-width:20px;height:20px;border-radius:10px;background:#e5484d;color:#fff;font-size:11px;display:grid;place-items:center;padding:0 6px}
  .p-out{margin-top:16px}
  .adr{display:flex;gap:12px;align-items:flex-start}.adr .p-ic{margin-top:2px}.adr .b{flex:1}
  .adr .ac{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.adr .ac .pbtn{height:38px;font-size:13px;padding:0 12px}
  .pin{width:100%;height:48px;border:1.5px solid #d6e0de;border-radius:12px;padding:0 12px;font:inherit;font-size:14px;background:#fff;color:#1c2b2b;margin:6px 0 12px}
  .plbl{font-size:12px;font-weight:700;color:#4a5a59}
  .pay{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:2px solid #e3eae8;background:#fff;border-radius:16px;padding:14px;margin-bottom:12px;font-family:inherit;color:#1c2b2b}
  .pay.sel{border-color:#00a86b;background:#f1fbf6}
  .pay .lg{width:64px;height:44px;border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:13px;overflow:hidden;flex:none}
  .pay .lg img{width:100%;height:100%;object-fit:contain;background:#fff}
  .pay .nm{flex:1}.pay .nm b{display:flex;align-items:center;font-size:15px}.pay .nm b .ico{color:#00a86b}.pay .nm span{display:block;font-size:12px;color:#6b7b7a;margin-top:2px}
  .pay .rd{width:22px;height:22px;border-radius:50%;border:2px solid #c5d1cf;display:grid;place-items:center;color:#fff;flex:none}
  .pay.sel .rd{background:#00a86b;border-color:#00a86b}.pay .rd .ico{width:14px;height:14px;margin:0;stroke-width:3}
  .ntf{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;border:0;background:#fff;border-radius:16px;padding:14px;margin-bottom:10px;font-family:inherit;color:#1c2b2b;box-shadow:0 3px 12px rgba(0,0,0,.05)}
  .ntf.novo{box-shadow:inset 4px 0 0 #00a86b,0 3px 12px rgba(0,0,0,.05)}
  .ntf b{display:block;font-size:14px;margin-bottom:2px}.ntf small{display:block;color:#8a9998;font-size:11px;margin-top:4px}.ntf span.m{font-size:13px;color:#4a5a59;line-height:1.4}
  .pempty{text-align:center;color:#8a9998;padding:40px 20px;font-size:14px}.pempty .ico{width:44px;height:44px;margin:0 0 8px;display:block;margin-inline:auto}
  .hstep{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.45}
  .hstep i{font-style:normal;width:28px;height:28px;border-radius:50%;background:#00a86b;color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px;flex:none}
  .hrow{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
  .ab-logo{display:block;width:92px;height:92px;border-radius:24px;margin:4px auto 10px;object-fit:cover;box-shadow:0 6px 20px rgba(0,0,0,.15)}
  .ab-t{text-align:center;font-size:20px;font-weight:800;margin:0}.ab-s{text-align:center;color:#6b7b7a;font-size:13px;margin:2px 0 16px}
  .ab-p{font-size:14px;line-height:1.6;color:#33403f;margin:0 0 10px}
  .ab-row{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid #eef2f1}.ab-row:first-of-type{border-top:0}
  .ab-row b{display:block;font-size:14px}.ab-row span{font-size:12px;color:#6b7b7a}
  .cf{position:absolute;inset:0;z-index:80;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:24px}
  .cf.on{display:flex}
  .cf-b{background:#fff;color:#1c2b2b;border-radius:24px;padding:24px 20px 20px;width:100%;max-width:340px;text-align:center;animation:cfin .22s ease}
  @keyframes cfin{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}
  .cf-lg{width:76px;height:76px;border-radius:20px;object-fit:cover;box-shadow:0 6px 18px rgba(0,0,0,.18);margin-bottom:12px}
  .cf-b h3{margin:0 0 6px;font-size:19px;display:flex;align-items:center;justify-content:center}.cf-b h3 .ico{color:#d94b59}
  .cf-b p{margin:0 0 18px;color:#5b6b6a;font-size:14px;line-height:1.45}
  .cf-a{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cf-a .pbtn{height:48px}
  `;
  document.head.appendChild(st);

  /* ---------- confirmação (logo + ícone + Sim/Não) ---------- */
  const cf = document.createElement('div');
  cf.className = 'cf'; cf.id = 'cf';
  cf.innerHTML = '<div class="cf-b" role="dialog" aria-modal="true"><img class="cf-lg" src="assets/logo.png" alt="Kanandzika"><h3 id="cfT"></h3><p id="cfP"></p><div class="cf-a"><button class="pbtn sec" id="cfN"></button><button class="pbtn" id="cfS"></button></div></div>';
  APP.appendChild(cf);
  let cfCb = null;
  window.confirmar = function (o, cb) {
    $('cfT').innerHTML = U(o.icone || 'alerta') + esc(o.titulo);
    $('cfP').textContent = o.texto;
    $('cfS').innerHTML = U('ok') + (o.sim || 'Sim');
    $('cfN').innerHTML = U('fechar') + (o.nao || 'Não');
    cfCb = cb; cf.classList.add('on');
  };
  const cfFecha = () => { cf.classList.remove('on'); cfCb = null; };
  $('cfN').onclick = () => { const c = cfCb; cfFecha(); if (c) c(false); };
  $('cfS').onclick = () => { const c = cfCb; cfFecha(); if (c) c(true); };
  cf.addEventListener('click', e => { if (e.target === cf) $('cfN').click(); });

  /* ---------- terminar sessão com confirmação ---------- */
  const logoutReal = window.logout;
  window.logout = function () {
    confirmar({ icone: 'sair', titulo: 'Terminar sessão?', texto: 'Tem a certeza de que quer sair da sua conta?', sim: 'Sim, sair', nao: 'Não' },
      ok => { if (ok) logoutReal(); });
  };

  /* ---------- sair do aplicativo (botão voltar do telemóvel) ---------- */
  let saindo = false;
  history.replaceState({ kz: 0 }, '');
  history.pushState({ kz: 1 }, '');
  window.addEventListener('popstate', () => {
    if (saindo) return;
    if (cf.classList.contains('on')) { history.pushState({ kz: 1 }, ''); $('cfN').click(); return; }
    const aberto = document.querySelector('.sheet.open');
    if (aberto) { history.pushState({ kz: 1 }, ''); if (aberto.classList.contains('psub')) openSheet('sh-profile'); else closeSheets(); return; }
    confirmar({ icone: 'sair', titulo: 'Sair do aplicativo?', texto: 'Tem a certeza de que quer fechar a Kanandzika?', sim: 'Sim, sair', nao: 'Não' }, ok => {
      if (!ok) { history.pushState({ kz: 1 }, ''); return; }
      saindo = true;
      try { window.close(); } catch (e) { }
      history.go(-(history.length - 1) || -1);
      setTimeout(() => { try { history.back(); } catch (e) { } }, 150);
    });
  });

  /* ---------- sub-ecrãs ---------- */
  function mk(id, titulo, icone) {
    const d = document.createElement('div');
    d.className = 'sheet psub'; d.id = id;
    d.innerHTML = '<div class="sh-head"><button class="sh-back" onclick="openSheet(\'sh-profile\')" aria-label="Voltar">' + U('voltar', 'so') + 'Voltar</button><h2>' + U(icone) + titulo + '</h2></div><div class="sh-body" id="' + id + 'B"></div>';
    APP.appendChild(d); return d;
  }
  mk('sh-addr', 'Meus endereços', 'pin');
  mk('sh-pay', 'Métodos de pagamento', 'cartao');
  mk('sh-ntf', 'Notificações', 'sino');
  mk('sh-help', 'Ajuda e suporte', 'ajuda');
  mk('sh-about', 'Sobre a Kanandzika', 'info');

  const abrirOrig = window.openSheet;
  window.openSheet = function (id) {
    abrirOrig(id);
    if (id === 'sh-addr') pAddr();
    if (id === 'sh-pay') pPay();
    if (id === 'sh-ntf') pNtf();
    if (id === 'sh-help') pHelp();
    if (id === 'sh-about') pAbout();
  };
  // o "Voltar" do perfil fecha tudo; nos sub-ecrãs volta ao perfil (já definido no mk)

  /* ---------- endereços guardados ---------- */
  const addrs = () => load('kz_addrs', []);
  window.pAddr = function () {
    const L = addrs();
    $('sh-addrB').innerHTML =
      (L.length ? L.map((a, i) => '<div class="pcard adr"><div class="p-ic">' + U('pin', 'so') + '</div><div class="b"><h4>' + esc(a.nome) + '</h4><div class="pmut">' + esc(a.bairro) + (a.ref ? '<br>' + esc(a.ref) : '') + '</div><div class="ac"><button class="pbtn" onclick="usarAddr(' + i + ')">' + U('ok') + 'Usar</button><button class="pbtn red" onclick="apagarAddr(' + i + ')">' + U('lixo') + 'Apagar</button></div></div></div>').join('')
        : '<div class="pempty">' + U('pin') + 'Ainda não tem endereços guardados.</div>') +
      '<div class="pcard"><h4>Novo endereço</h4><label class="plbl">Nome (ex.: Casa, Trabalho)</label><input class="pin" id="aN" maxlength="30" placeholder="Casa"><label class="plbl">Bairro</label><select class="pin" id="aB"><option value="">Selecione o bairro</option>' + BAIRROS.map(b => '<option>' + esc(b) + '</option>').join('') + '</select><label class="plbl">Local de referência (opcional)</label><input class="pin" id="aR" maxlength="80" placeholder="Ex: perto da paragem"><button class="pbtn full" onclick="guardarAddr()">' + U('ok') + 'Guardar endereço</button></div>';
  };
  window.guardarAddr = function () {
    const nome = $('aN').value.trim(), bairro = $('aB').value, ref = $('aR').value.trim();
    if (!nome) return toast('Dê um nome ao endereço.');
    if (!BAIRROS.includes(bairro)) return toast('Selecione o bairro.');
    const L = addrs(); if (L.length >= 10) return toast('Pode guardar até 10 endereços.');
    L.push({ nome, bairro, ref }); save('kz_addrs', L); toast('Endereço guardado'); pAddr();
  };
  window.apagarAddr = function (i) {
    confirmar({ icone: 'lixo', titulo: 'Apagar endereço?', texto: 'Este endereço será removido.', sim: 'Sim, apagar', nao: 'Não' }, ok => {
      if (!ok) return; const L = addrs(); L.splice(i, 1); save('kz_addrs', L); pAddr();
    });
  };
  window.usarAddr = function (i) {
    const a = addrs()[i]; if (!a) return;
    state.bairro = a.bairro; state.ref = a.ref || ''; $('bairro').value = a.bairro; $('ref').value = a.ref || '';
    setType('Delivery'); openSheet('sh-type'); toast('Endereço aplicado ao pedido');
  };

  /* ---------- métodos de pagamento ---------- */
  const PAGS = [
    { id: 'emola', nome: 'e-Mola', desc: 'Pagamento móvel Movitel', cor: '#f59e0b', ic: 'phone', img: 'assets/emola.png' },
    { id: 'mpesa', nome: 'M-Pesa', desc: 'Pagamento móvel Vodacom', cor: '#e11d2e', ic: 'phone', img: 'assets/mpesa.png' },
    { id: 'cash', nome: 'Numerário', desc: 'Pague em dinheiro na entrega ou na loja', cor: '#0f9d58', ic: 'dinheiro', img: 'assets/numerario.png' }
  ];
  window.pPay = function () {
    const sel = load('kz_pay', '');
    $('sh-payB').innerHTML = '<p class="pmut" style="margin:0 2px 14px">Escolha como prefere pagar os seus pedidos.</p>' + PAGS.map(p =>
      '<button class="pay' + (sel === p.id ? ' sel' : '') + '" onclick="escolherPag(\'' + p.id + '\')"><span class="lg" style="background:' + p.cor + '"><img src="' + p.img + '" alt="" onerror="this.remove()">' + esc(p.nome === 'Numerário' ? 'MT' : p.nome) + '</span><span class="nm"><b>' + U(p.ic) + esc(p.nome) + '</b><span>' + esc(p.desc) + '</span></span><span class="rd">' + (sel === p.id ? U('ok', 'so') : '') + '</span></button>').join('');
  };
  window.escolherPag = function (id) { save('kz_pay', id); pPay(); toast('Pagamento preferido: ' + PAGS.find(p => p.id === id).nome); };

  /* ---------- notificações ---------- */
  function lista() {
    const N = [];
    const seen = Number(load('kz_ntf_seen', 0)) || 0;
    try {
      const cs = Number(load('kz_chat_seen', 0)) || 0;
      (chat.msgs || []).filter(m => m.sender !== 'cliente').slice(-5).forEach(m =>
        N.push({ t: new Date(m.created_at).getTime(), ic: 'chat', tt: 'Mensagem do suporte', m: m.message, novo: m.id > cs, go: 'openChat()' }));
    } catch (e) { }
    load('kz_orders', []).slice(-8).forEach(o =>
      N.push({ t: o.ts, ic: o.type === 'Delivery' ? 'entrega' : 'talher', tt: 'Pedido #' + String(o.id).padStart(3, '0') + ' enviado', m: 'Total ' + mt(o.total) + (o.type === 'Delivery' ? ' · toque para acompanhar a entrega' : ' · Mesa ' + o.mesa), novo: o.ts > seen,
        go: o.track_id ? "openTrack('" + o.track_id + "')" : "openSheet('sh-orders')" }));
    N.push({ t: 0, ic: 'burger', tt: 'Bem-vindo à Kanandzika', m: 'Faça o seu pedido, escolha delivery ou mesa e acompanhe tudo pelo app.', novo: false, go: "closeSheets()" });
    return N.sort((a, b) => b.t - a.t);
  }
  window.nNovas = () => lista().filter(n => n.novo).length;
  window.pNtf = function () {
    const L = lista();
    $('sh-ntfB').innerHTML = L.map(n => '<button class="ntf' + (n.novo ? ' novo' : '') + '" onclick="' + n.go + '"><span class="p-ic">' + U(n.ic, 'so') + '</span><span style="flex:1"><b>' + esc(n.tt) + '</b><span class="m">' + esc(n.m) + '</span>' + (n.t ? '<small>' + fmtDate(n.t) + '</small>' : '') + '</span></button>').join('');
    save('kz_ntf_seen', Date.now());
  };

  /* ---------- ajuda e suporte (estilo tutorial) ---------- */
  window.pHelp = function () {
    const P = ['Escolha os seus lanches no ecrã inicial e toque em <b>Add</b> para pôr no carrinho.', 'Abra o <b>Carrinho</b>, ajuste as quantidades e toque em <b>Fazer pedido</b>.', 'Escolha <b>Delivery</b> (indique o bairro; a taxa é 50 MT) ou <b>Mesa</b> (mesa 1 a 5).', 'Confira o resumo e toque em <b>Enviar pedido</b>.', 'Em <b>Rastreio</b> vê o entregador a caminho em tempo real.', 'Precisa de ajuda? Fale connosco pelo chat ou ligue.'];
    $('sh-helpB').innerHTML = '<div class="pcard"><h4>Como usar o app</h4><p class="pmut" style="margin:0">Siga estes passos simples.</p></div>' +
      P.map((t, i) => '<div class="pcard hstep"><i>' + (i + 1) + '</i><div>' + t + '</div></div>').join('') +
      '<div class="pcard"><h4>Fale connosco</h4><div class="hrow"><button class="pbtn" onclick="openChat()">' + U('chat') + 'Chat</button><a class="pbtn sec" href="tel:' + TEL + '">' + U('phone') + 'Ligar</a></div></div>';
  };

  /* ---------- sobre ---------- */
  window.pAbout = function () {
    $('sh-aboutB').innerHTML = '<img class="ab-logo" src="assets/logo.png" alt="Kanandzika"><h3 class="ab-t">Kanandzika</h3><p class="ab-s">Lanchonete Premium · Versão 1.0.0</p>' +
      '<div class="pcard"><p class="ab-p">A Kanandzika é uma lanchonete com loja física na paragem Thandavanto, em Boane. Este aplicativo foi criado para facilitar as entregas, as reservas e o cardápio online, e muito mais.</p><p class="ab-p" style="margin:0">Peça de onde estiver, acompanhe a sua entrega em tempo real e fale connosco directamente pelo app.</p></div>' +
      '<div class="pcard"><h4 style="margin-bottom:6px">A nossa equipa</h4>' +
      '<div class="ab-row"><span class="p-ic">' + U('user', 'so') + '</span><div><b>Rivaldo Ananias Chirrindzane</b><span>CEO</span></div></div>' +
      '<div class="ab-row"><span class="p-ic">' + U('user', 'so') + '</span><div><b>Antonieta André Mahumana</b><span>COO</span></div></div></div>' +
      '<div class="pcard"><h4 style="margin-bottom:6px">Onde estamos</h4><div class="ab-row"><span class="p-ic">' + U('pin', 'so') + '</span><div><b>Paragem Thandavanto</b><span>Boane</span></div></div><div class="ab-row"><span class="p-ic">' + U('phone', 'so') + '</span><div><b>+258 84 792 3879</b><span>Ligue-nos</span></div></div></div>';
  };

  /* ---------- perfil principal ---------- */
  window.renderProfile = function () {
    const src = avatarSrc(), n = nNovas(), pedidos = load('kz_orders', []).length;
    $('profileBody').innerHTML =
      '<div class="pcard u-card"><div class="u-av">' + (src ? '<img src="' + esc(src) + '" alt="">' : U('user', 'so')) + '</div><div class="u-i"><strong>' + esc(user ? user.name : 'Cliente') + '</strong><span>' + (user && user.phone ? fmtPhone(user.phone) : '') + '</span><span>' + pedidos + (pedidos === 1 ? ' pedido feito' : ' pedidos feitos') + '</span></div><button class="pbtn sec" style="height:40px;padding:0 12px" onclick="trocarFoto()">' + U('camera') + 'Foto</button></div>' +
      '<div class="p-ban"><div class="bi">' + U('estrela', 'so') + '</div><div class="t"><strong>A sua opinião conta</strong><span>Diga-nos o que podemos melhorar.</span></div><button class="pbtn" onclick="openFeedback()">' + U('estrela') + 'Feedback</button></div>' +
      '<div class="p-menu">' +
      it('pin', 'Meus endereços', "openSheet('sh-addr')") + it('cartao', 'Métodos de pagamento', "openSheet('sh-pay')") +
      it('sino', 'Notificações', "openSheet('sh-ntf')", n) + it('ajuda', 'Ajuda e suporte', "openSheet('sh-help')") + it('info', 'Sobre a Kanandzika', "openSheet('sh-about')") + '</div>' +
      '<button class="pbtn red full p-out" onclick="logout()">' + U('sair') + 'Terminar sessão</button>';
  };
  function it(ic, tx, go, bd) {
    return '<button class="p-it" onclick="' + go + '"><span class="p-ic">' + U(ic, 'so') + '</span><span class="tx">' + tx + '</span>' + (bd ? '<span class="p-bd">' + bd + '</span>' : '') + '<span class="ch">' + U('seta', 'so') + '</span></button>';
  }
  window.notify = function () { openSheet('sh-ntf'); };
})();

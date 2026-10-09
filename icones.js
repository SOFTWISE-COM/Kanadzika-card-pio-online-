/* Biblioteca de ícones (SVG de linha) partilhada por todas as páginas.
   Uso em HTML:  <svg class="ico"><use href="#i-casa"/></svg>
   Uso em JS:    Ico('casa')  ->  string SVG */
(function () {
  const P = {
    // pessoa a andar a levar um prato (entregador)
    entrega: '<circle cx="7.5" cy="5.5" r="2"/><path d="M7.7 8.8 8.8 15M8 10.200 4.500 12.800M8 10.200l4.300-.9 4-3.800M8.800 15 5.500 21.500M8.800 15l4.200 2.800-.4 3.700"/><path d="M11.500 4.700h10.500"/><path d="M13.700 4.700a3.300 3.300 0 0 1 6.600 0"/>',
    moto: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M5.5 17 8.5 11h5l2.5 6M13.5 11l-1.2-3.5H10M15.5 7.5h3l1.5 3.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    alvo: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    casa: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    carrinho: '<path d="M3 4h2l2 12h10l3-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
    caixa: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    recibo: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',
    dinheiro: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    camiao: '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="6.5" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    talher: '<path d="M7 3v8a2 2 0 0 0 2 2v8M7 3v6M11 3v6a2 2 0 0 1-2 2M17 21V3c-2.5 1.5-3.500 5-3.500 8H17"/>',
    cadeira: '<path d="M7 3h10v8H7zM6 11h12v3H6zM8 14v7M16 14v7"/>',
    nota: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    ok: '<path d="M5 12l5 5 9-10"/>',
    alerta: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.500 6.500l4 4"/>',
    enviar: '<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    voltar: '<path d="M15 18l-6-6 6-6"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    defs: '<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 0 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 0 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3h0a1.700 1.700 0 0 0 1-1.500V3a2 2 0 0 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.100a1.700 1.700 0 0 0-.3 1.800v0a1.700 1.700 0 0 0 1.500 1H21a2 2 0 0 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
    estrela: '<path d="M12 2.500l2.900 6 6.600.9-4.800 4.600 1.200 6.500-5.900-3.100-5.900 3.100 1.200-6.500L2.500 9.400l6.600-.9z"/>',
    sino: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 1-1 1.700M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    cartao: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    bilhete: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1a2 2 0 0 1 0-4 2 2 0 0 0 0-4V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
    burger: '<path d="M4 11a8 8 0 0 1 16 0H4z"/><path d="M3 15h18M5 15v2a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-2"/>',
    fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.700 7L3 21l2-5.300A8 8 0 1 1 21 12z"/>',
    baixar: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.500"/>'
  };
  const CSS = 'svg.ico{width:1.15em;height:1.15em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:-.2em;margin-right:.45em}' +
    'svg.ico.so{margin-right:0}svg.ico.g{width:1.6em;height:1.6em}';
  window.ICONES = P;
  // string SVG (uso em templates JS). sozinho=true -> sem margem à direita
  window.Ico = function (n, o) {
    o = o || {};
    return '<svg class="ico' + (o.so ? ' so' : '') + (o.cls ? ' ' + o.cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
  };
  function ini() {
    if (document.getElementById('icoSprite')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'icoSprite'; d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">' + Object.keys(P).map(k => '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + P[k] + '</symbol>').join('') + '</svg>';
    document.body.insertBefore(d, document.body.firstChild);
  }
  if (document.body) ini(); else document.addEventListener('DOMContentLoaded', ini);
})();

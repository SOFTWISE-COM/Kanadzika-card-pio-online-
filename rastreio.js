/* Ajudas partilhadas do rastreio (mapa, distância, tempo estimado) */
(function () {
  // Localização da loja física Kanandzika (latitude, longitude)
  const LOJA = { lat: -25.993563, lng: 32.423748, nome: 'Kanandzika Lanchonete Premium' };

  const rad = d => d * Math.PI / 180;
  function dist(a, b) { // metros em linha reta (haversine)
    const R = 6371000, dLa = rad(b.lat - a.lat), dLo = rad(b.lng - a.lng);
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const fmtDist = m => m < 1000 ? (Math.max(10, Math.round(m / 10) * 10)) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
  const fmtMin = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
  const ago = iso => { const s = (Date.now() - new Date(iso).getTime()) / 1000; return s < 60 ? 'agora mesmo' : 'há ' + Math.round(s / 60) + ' min'; };

  // Tempo estimado por estrada (OSRM público). Se falhar, estima pela distância em linha reta.
  let last = 0, cache = null, cacheKey = '';
  async function eta(a, b) {
    const reta = dist(a, b);
    const fallback = { metros: reta * 1.3, segundos: (reta * 1.3) / (25000 / 3600), aprox: true, coords: [[a.lat, a.lng], [b.lat, b.lng]] }; // ~25 km/h
    const key = [a.lat, a.lng, b.lat, b.lng].map(n => n.toFixed(4)).join(',');
    if (Date.now() - last < 15000 && cache && cacheKey === key) return cache;
    last = Date.now(); cacheKey = key;
    try {
      const c = new AbortController(); setTimeout(() => c.abort(), 6000);
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: c.signal });
      const j = await r.json();
      if (j.code === 'Ok' && j.routes && j.routes[0]) cache = { metros: j.routes[0].distance, segundos: j.routes[0].duration, aprox: false,
        coords: (j.routes[0].geometry.coordinates || []).map(c => [c[1], c[0]]) };
      else cache = fallback;
    } catch (e) { cache = fallback; }
    return cache;
  }

  function mapa(id) {
    const m = L.map(id, { zoomControl: false, attributionControl: true }).setView([-25.97, 32.57], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    return m;
  }
  const S = (p, w) => `<svg viewBox="0 0 24 24" width="${w || 22}" height="${w || 22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICO = {
    moto: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M5.5 17 8.5 11h5l2.5 6M13.5 11l-1.2-3.5H10M15.5 7.5h3l1.5 3.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    entrega: '<circle cx="7.5" cy="5.5" r="2"/><path d="M7.7 8.8 8.8 15M8 10.2 4.5 12.8M8 10.2l4.3-.9 4-3.8M8.8 15 5.5 21.5M8.8 15l4.2 2.8-.4 3.7"/><path d="M11.5 4.7H22"/><path d="M13.7 4.7a3.3 3.3 0 0 1 6.6 0"/>',
    loja: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 12v8h14v-8"/><path d="M10 20v-4h4v4"/>',
    casa: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    bici: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9.5 9h5.5l3.5 7.5M9.5 9l2.5 7.5 3-7.5M14 6.5h2.5"/>',
    carro: '<path d="M3.5 16v-3.5L6 7h12l2.5 5.5V16"/><path d="M3.5 12.5h17"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
    ape: '<circle cx="13" cy="4.5" r="2"/><path d="M12 8.5 10 14l3 2 1 5M12 8.5l3 3 3 .5M12 8.5l-3 2-1 3M10 14l-3 6"/>',
    cliente: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };
  // Meio de transporte -> chave do ícone (moto, bici, carro, ape)
  const veic = v => { v = String(v || '').toLowerCase(); return /bici|bike/.test(v) ? 'bici' : /carro|car|viatura/.test(v) ? 'carro' : /p[eé]$|a p|pe$|pedes/.test(v) ? 'ape' : 'moto'; };
  // tipo: 'drv' ou 'drv:<meio de transporte>' (entregador) ou 'cli' (cliente)
  const pin = t0 => {
    const pt = String(t0).split(':'), t = pt[0], vk = veic(pt.slice(1).join(':'));
    const drv = t === 'drv', loja = t === 'loja';
    if (loja) return L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 22],
      html: `<div style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.45);background:#ffb020;color:#3b2500">${S(ICO.loja, 26)}</div>` });
    return L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 22],
      html: `<div style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.45);background:${drv ? '#00e5ff' : '#ff4357'};color:${drv ? '#00282d' : '#fff'}">${S(drv ? ICO[vk] : ICO.cliente, 26)}</div>` });
  };
  function marcar(m, store, chave, p, tipo) {
    if (!p) return;
    if (store[chave]) store[chave].setLatLng([p.lat, p.lng]);
    else store[chave] = L.marker([p.lat, p.lng], { icon: pin(tipo), zIndexOffset: String(tipo).indexOf('drv') === 0 ? 1000 : 0 }).addTo(m);
  }
  // Desenha a trajetória por estrada entre o entregador (a) e o cliente (b)
  function rota(m, store, e, a, b) {
    if (!e || !e.coords || e.coords.length < 2) return;
    const pts = [[a.lat, a.lng]].concat(e.coords, [[b.lat, b.lng]]);
    if (store.rota) { store.rota.setLatLngs(pts); store.rotaBase.setLatLngs(pts); return; }
    store.rotaBase = L.polyline(pts, { color: '#ffffff', weight: 9, opacity: .9, lineCap: 'round', lineJoin: 'round' }).addTo(m);
    store.rota = L.polyline(pts, { color: '#0a8b92', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: e.aprox ? '2 10' : null }).addTo(m);
  }
  // Etiqueta com o tempo, no meio da trajetória
  function etiqueta(m, store, e, texto) {
    if (!e || !e.coords || e.coords.length < 2) return;
    const c = e.coords[Math.floor(e.coords.length / 2)];
    const icon = L.divIcon({ className: '', iconSize: [0, 0], iconAnchor: [0, 0],
      html: `<div style="transform:translate(-50%,-135%);white-space:nowrap;background:#fff;color:#0b2a2e;font:600 13px 'IBM Plex Sans',system-ui,sans-serif;padding:5px 11px;border-radius:14px;box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;gap:6px;align-items:center">${S(ICO.moto, 16)}${texto}</div>` });
    if (store.lbl) { store.lbl.setLatLng(c); store.lbl.setIcon(icon); }
    else store.lbl = L.marker(c, { icon, interactive: false, zIndexOffset: 2000 }).addTo(m);
  }
  function enquadrar(m, pts, forcar) {
    const v = pts.filter(Boolean);
    if (!v.length) return;
    const b = L.latLngBounds(v.map(p => [p.lat, p.lng]));
    if (forcar || !m.getBounds().contains(b)) {
      if (v.length === 1) m.setView([v[0].lat, v[0].lng], 16);
      else m.fitBounds(b, { padding: [50, 50], maxZoom: 17 });
    }
  }
  window.Rastreio = { veic, dist, fmtDist, fmtMin, ago, eta, mapa, marcar, rota, etiqueta, enquadrar, LOJA, S, ICO };
})();

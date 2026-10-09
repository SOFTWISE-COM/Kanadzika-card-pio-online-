/* Ajudas partilhadas do rastreio (mapa, distância, tempo estimado) */
(function () {
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
  let last = 0, cache = null;
  async function eta(a, b) {
    const reta = dist(a, b);
    const fallback = { metros: reta * 1.3, segundos: (reta * 1.3) / (25000 / 3600), aprox: true, coords: [[a.lat, a.lng], [b.lat, b.lng]] }; // ~25 km/h
    if (Date.now() - last < 15000 && cache) return cache;
    last = Date.now();
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
    casa: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'
  };
  // tipo: 'drv' (entregador) ou 'cli' (cliente)
  const pin = t => {
    const drv = t === 'drv';
    return L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 22],
      html: `<div style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.45);background:${drv ? '#00e5ff' : '#ff4357'};color:${drv ? '#00282d' : '#fff'}">${S(drv ? ICO.entrega : ICO.casa, 26)}</div>` });
  };
  function marcar(m, store, chave, p, tipo) {
    if (!p) return;
    if (store[chave]) store[chave].setLatLng([p.lat, p.lng]);
    else store[chave] = L.marker([p.lat, p.lng], { icon: pin(tipo), zIndexOffset: tipo === 'drv' ? 1000 : 0 }).addTo(m);
  }
  // Desenha a trajetória por estrada entre o entregador (a) e o cliente (b)
  function rota(m, store, e, a, b) {
    if (!e || !e.coords || e.coords.length < 2) return;
    const pts = [[a.lat, a.lng]].concat(e.coords, [[b.lat, b.lng]]);
    if (store.rota) { store.rota.setLatLngs(pts); store.rotaBase.setLatLngs(pts); return; }
    store.rotaBase = L.polyline(pts, { color: '#ffffff', weight: 9, opacity: .9, lineCap: 'round', lineJoin: 'round' }).addTo(m);
    store.rota = L.polyline(pts, { color: '#0a8b92', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: e.aprox ? '2 10' : null }).addTo(m);
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
  window.Rastreio = { dist, fmtDist, fmtMin, ago, eta, mapa, marcar, rota, enquadrar, S, ICO };
})();

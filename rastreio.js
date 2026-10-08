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
    const fallback = { metros: reta * 1.3, segundos: (reta * 1.3) / (25000 / 3600), aprox: true }; // ~25 km/h
    if (Date.now() - last < 15000 && cache) return cache;
    last = Date.now();
    try {
      const c = new AbortController(); setTimeout(() => c.abort(), 6000);
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { signal: c.signal });
      const j = await r.json();
      if (j.code === 'Ok' && j.routes && j.routes[0]) cache = { metros: j.routes[0].distance, segundos: j.routes[0].duration, aprox: false };
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
  const pin = e => L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17],
    html: `<div style="font-size:26px;line-height:34px;text-align:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">${e}</div>` });
  function marcar(m, store, chave, p, emoji) {
    if (!p) return;
    if (store[chave]) store[chave].setLatLng([p.lat, p.lng]);
    else store[chave] = L.marker([p.lat, p.lng], { icon: pin(emoji) }).addTo(m);
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
  window.Rastreio = { dist, fmtDist, fmtMin, ago, eta, mapa, marcar, enquadrar };
})();

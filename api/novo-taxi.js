const webpush = require('web-push');
const db = require('../lib/db');
const { TAXI } = require('../lib/config');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rad = (d) => (d * Math.PI) / 180;
const km = (a, b) => {
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
};

// POST /api/novo-taxi   { track_id }
// Chamado pelo app do cliente logo depois de pedir um Kanandzika-Taxi.
// Avisa (push) os entregadores ONLINE com o MESMO tipo de veículo (moto / carro)
// que estão perto do ponto de partida. Só avisa uma vez por corrida.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(501).json({ ok: false, erro: 'vapid' });

  const tid = String((req.body || {}).track_id || '');
  if (!UUID.test(tid)) return res.status(400).json({ ok: false });

  const d = db();
  const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  // "reserva" o aviso: só uma chamada consegue passar notificado de false para true
  const { data: rid, error } = await d.from('rides')
    .update({ notificado: true })
    .eq('track_id', tid).eq('estado', 'pendente').eq('notificado', false)
    .gte('created_at', desde)
    .select('id,veiculo,preco,comissao,dist_m,o_lat,o_lng')
    .limit(1);
  if (error) return res.status(500).json({ ok: false });
  if (!rid || !rid.length) return res.json({ ok: true, enviadas: 0 });
  const r = rid[0];

  const { data: drv } = await d.from('drivers').select('phone,lat,lng,vehicle,saldo')
    .eq('status', 'aprovado').eq('online', true).gte('saldo', r.comissao);
  const origem = { lat: r.o_lat, lng: r.o_lng };
  const perto = (drv || []).filter((x) => x.phone &&
    String(x.vehicle || '').trim().toLowerCase() === r.veiculo &&
    (x.lat == null || x.lng == null || km(origem, { lat: x.lat, lng: x.lng }) <= TAXI.RAIO_KM));
  if (!perto.length) return res.json({ ok: true, enviadas: 0 });

  const { data: subs } = await d.from('push_subs').select('endpoint,p256dh,auth')
    .in('phone', perto.map((x) => String(x.phone).slice(-9)));
  webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:admin@kanandzika.app', pub, priv);
  const payload = JSON.stringify({
    title: 'Kanandzika-Taxi: nova corrida!',
    body: `${r.veiculo === 'moto' ? 'Moto' : 'Carro'} · ${(r.dist_m / 1000).toFixed(1).replace('.', ',')} km · ${r.preco} MT (ganha ${r.preco - r.comissao} MT)`,
    url: 'entregador.html#taxi', tag: 'kz-taxi-' + r.id,
  });
  const mortas = [];
  let enviadas = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 600, urgency: 'high' });
      enviadas++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) mortas.push(s.endpoint);
    }
  }));
  if (mortas.length) await d.from('push_subs').delete().in('endpoint', mortas);
  res.json({ ok: true, enviadas });
};

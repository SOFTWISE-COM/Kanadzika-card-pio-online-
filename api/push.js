const webpush = require('web-push');
const db = require('../lib/db');

// POST /api/push   (só o administrador)
// Cabeçalho: Authorization: Bearer <token da sessão do painel>
// body: { phone: '84xxxxxxx' | todos: true, titulo, mensagem, tag }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(501).json({ ok: false, erro: 'vapid' });

  const d = db();
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: u } = token ? await d.auth.getUser(token) : { data: null };
  const meta = (u && u.user && u.user.app_metadata) || {};
  if (meta.role !== 'admin') return res.status(401).json({ ok: false });

  const b = req.body || {};
  const titulo = String(b.titulo || '').slice(0, 120), msg = String(b.mensagem || '').slice(0, 300);
  if (!titulo || !msg) return res.status(400).json({ ok: false });
  // Só envia a todos se o painel pedir explicitamente (todos:true); senão exige 1 número válido
  const todos = b.todos === true;
  const phone = b.phone ? String(b.phone).replace(/\D/g, '').slice(-9) : null;
  if (!todos && (!phone || phone.length !== 9)) return res.status(400).json({ ok: false, erro: 'destinatario' });

  webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:admin@kanandzika.app', pub, priv);

  let q = d.from('push_subs').select('endpoint,p256dh,auth');
  if (!todos) q = q.eq('phone', phone);
  const { data: subs, error } = await q.limit(5000);
  if (error) return res.status(500).json({ ok: false });

  const payload = JSON.stringify({ title: titulo, body: msg, url: 'home.html', tag: b.tag || undefined });
  const mortas = [];
  let enviadas = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
      enviadas++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) mortas.push(s.endpoint);
    }
  }));
  if (mortas.length) await d.from('push_subs').delete().in('endpoint', mortas);
  res.json({ ok: true, enviadas, dispositivos: (subs || []).length });
};

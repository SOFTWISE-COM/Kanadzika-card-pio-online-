const crypto = require('crypto');
const db = require('../lib/db');

const igual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const ESTADOS = ['novo', 'preparando', 'pronto', 'entregue', 'cancelado'];

// Painel do dono. Cabeçalho x-admin-key = ADMIN_PASSWORD
// GET   -> últimos 100 pedidos
// PATCH -> { id, estado }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_PASSWORD || !igual(req.headers['x-admin-key'], process.env.ADMIN_PASSWORD))
    return res.status(401).json({ ok: false });

  const d = db();
  if (req.method === 'GET') {
    const { data, error } = await d.from('pedidos').select('*').order('id', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ ok: false });
    return res.json({ ok: true, pedidos: data });
  }
  if (req.method === 'PATCH') {
    const { id, estado } = req.body || {};
    if (!Number.isInteger(id) || !ESTADOS.includes(estado)) return res.status(400).json({ ok: false });
    const { error } = await d.from('pedidos').update({ estado }).eq('id', id);
    if (error) return res.status(500).json({ ok: false });
    return res.json({ ok: true });
  }
  res.status(405).json({ ok: false });
};

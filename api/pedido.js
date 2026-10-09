const db = require('../lib/db');
const { BAIRROS, TAXA, NOME } = require('../lib/config');
const { enviar } = require('../lib/whatsapp');

const s = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const bad = (res, motivo) => res.status(400).json({ ok: false, erro: motivo });
const MT = (n) => n.toLocaleString('pt-PT') + ' MT';

// POST /api/pedido
// body: { tipo, mesa, cliente, telefone, bairro, referencia, obs, itens:[{id,q}] }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const b = req.body || {};

  const tipo = b.tipo === 'delivery' ? 'delivery' : 'mesa';
  const mesa = s(b.mesa, 6).replace(/\D/g, '');
  const cliente = s(b.cliente, 60);
  const telefone = s(b.telefone, 12).replace(/\D/g, '');
  const bairro = s(b.bairro, 60);
  const referencia = s(b.referencia, 120);
  const obs = s(b.obs, 200);

  if (tipo === 'mesa' && !mesa) return bad(res, 'mesa');
  if (tipo === 'delivery' && (!cliente || telefone.length !== 9 || !BAIRROS.includes(bairro)))
    return bad(res, 'dados');

  // Junta itens repetidos e valida quantidades
  const qtd = new Map();
  for (const it of (Array.isArray(b.itens) ? b.itens.slice(0, 30) : [])) {
    const id = Number(it.id), q = Number(it.q);
    if (!Number.isInteger(id) || !Number.isInteger(q) || q < 1 || q > 20) return bad(res, 'itens');
    qtd.set(id, (qtd.get(id) || 0) + q);
  }
  if (!qtd.size) return bad(res, 'itens');

  const d = db();

  // Proteção simples contra abuso: máx. 20 pedidos por minuto
  const desde = new Date(Date.now() - 60000).toISOString();
  const { count } = await d.from('pedidos').select('id', { count: 'exact', head: true }).gte('criado_em', desde);
  if (count >= 20) return res.status(429).json({ ok: false });

  // Preços vêm SEMPRE da base de dados (o cliente não manda preços)
  const { data: prods, error } = await d
    .from('produtos').select('id,nome,preco').in('id', [...qtd.keys()]).eq('ativo', true);
  if (error || prods.length !== qtd.size) return bad(res, 'produtos');

  const itens = prods.map((p) => ({ id: p.id, nome: p.nome, q: qtd.get(p.id), preco: p.preco }));
  const subtotal = itens.reduce((t, i) => t + i.q * i.preco, 0);
  const taxa = tipo === 'delivery' ? TAXA : 0;
  const total = subtotal + taxa;

  const { data: ped, error: e2 } = await d.from('pedidos').insert({
    tipo, mesa: mesa || null, cliente: cliente || null, telefone: telefone || null,
    bairro: bairro || null, referencia: referencia || null, itens, taxa, total, obs: obs || null,
  }).select('id').single();
  if (e2) return res.status(500).json({ ok: false });

  // Aviso no WhatsApp (opcional; se falhar o pedido continua gravado)
  try {
    const agora = new Date();
    const tz = { timeZone: 'Africa/Maputo' };
    const tel = telefone.replace(/(\d{2})(\d{3})(\d{4})/, '$1 $2 $3');
    let t = `*PEDIDO #${ped.id} - ${NOME.toUpperCase()}*\n\n*Data:* ${agora.toLocaleDateString('pt-PT', tz)} às ${agora.toLocaleTimeString('pt-PT', tz)}\n`;
    t += tipo === 'mesa'
      ? `*Tipo:* Na mesa\n*Mesa:* ${mesa}\n`
      : `*Tipo:* Delivery\n\n*Cliente:* ${cliente}\n*Tel:* +258 ${tel}\n*Bairro:* ${bairro}\n` +
        (referencia ? `*Referência:* ${referencia}\n` : '');
    t += `\n*ITENS:*\n` + itens.map((i) => `${i.q}x ${i.nome} — ${MT(i.q * i.preco)}`).join('\n') + '\n';
    if (taxa) t += `\n*Taxa de entrega:* ${MT(taxa)}\n`;
    if (obs) t += `\n*Obs:* ${obs}\n`;
    t += `\n*TOTAL: ${MT(total)}*`;
    await enviar(t);
  } catch (_) { /* ignora */ }

  res.json({ ok: true, id: ped.id, total });
};

const db = require('../lib/db');

// GET /api/produtos -> cardápio ativo, vindo da base de dados
module.exports = async (req, res) => {
  const { data, error } = await db()
    .from('produtos')
    .select('id,nome,descricao,preco,categoria,ordem')
    .eq('ativo', true)
    .order('ordem');
  if (error) return res.status(500).json({ ok: false });
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.json({ ok: true, produtos: data });
};

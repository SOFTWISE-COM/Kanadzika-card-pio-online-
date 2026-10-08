// Envio opcional do pedido ao seu WhatsApp.
// Variáveis na Vercel: WA_PROVIDER (whapi|ultramsg|meta|callmebot), WA_TOKEN,
// WA_INSTANCE (ultramsg/meta) e WA_TO (ex: 258852353210).
const J = { 'Content-Type': 'application/json' };

async function enviar(texto) {
  const p = process.env.WA_PROVIDER, k = process.env.WA_TOKEN;
  const i = process.env.WA_INSTANCE, to = process.env.WA_TO;
  if (!p || !k || !to) return false;
  let r;
  if (p === 'whapi')
    r = await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST', headers: { ...J, Authorization: 'Bearer ' + k },
      body: JSON.stringify({ to, body: texto }),
    });
  else if (p === 'ultramsg')
    r = await fetch(`https://api.ultramsg.com/${i}/messages/chat`, {
      method: 'POST', body: new URLSearchParams({ token: k, to: '+' + to, body: texto }),
    });
  else if (p === 'meta')
    r = await fetch(`https://graph.facebook.com/v20.0/${i}/messages`, {
      method: 'POST', headers: { ...J, Authorization: 'Bearer ' + k },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: texto } }),
    });
  else if (p === 'callmebot')
    r = await fetch('https://api.callmebot.com/whatsapp.php?' +
      new URLSearchParams({ phone: '+' + to, text: texto, apikey: k }));
  else return false;
  return r.ok;
}

module.exports = { enviar };

# Versão do entregador (v28)

## O que foi acrescentado
- **Login**: depois de entrar, o app pergunta "Cliente ou Entregador" (`index.html`). Também dá para trocar no Perfil ("Trabalhar como entregador") e no painel do entregador ("Usar como cliente").
- **`entregador.html`** (app do entregador): Meu painel (ganho de hoje, entregas, km, tempo, semana, últimas entregas), Mapa (pedidos novos com aviso, rota até à lanchonete e depois até ao cliente, deslizar para confirmar cada etapa) e Mensagens com o dono.
- **Painel do dono (`admin.html`) → separador "Entregadores"**: aprovar/suspender, estado de cada um (online, em entrega), ganho de hoje, **Mapa ao vivo**, **Trajeto** do dia e **Mensagens**.
- **Ganho**: 50 MT por entrega (`entregador_ganho()` no SQL, `GANHO_ENTREGA` em `lib/config.js` e `GANHO` em `entregador.html`).
- **Aviso por push** de pedido novo aos entregadores online a menos de 5 km da lanchonete (`api/novo-pedido.js`, `RAIO_KM` em `lib/config.js`).

## O que tem de fazer para ativar (1 vez)
1. Supabase → SQL Editor → colar e correr **`entregador.sql`** (já tem de ter corrido os outros .sql).
2. Enviar os ficheiros para o GitHub/Vercel como de costume (as chaves VAPID e SUPABASE_SERVICE_KEY que já usa servem; nada novo).
3. O entregador abre o app, entra, escolhe **Entregador** e toca em **Pedir acesso**.
4. No painel → **Entregadores** → **Aprovar**. O app dele abre sozinho.

## Segurança
- O entregador nunca escreve direto nas tabelas: aceitar pedido, mudar de etapa e enviar posição passam por funções do Supabase que validam tudo (só aprovados; só 1 entrega ativa; só ele mexe nos seus pedidos).
- Só entregadores aprovados veem pedidos Delivery livres e a localização do cliente desses pedidos.

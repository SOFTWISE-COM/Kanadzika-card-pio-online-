const { createClient } = require('@supabase/supabase-js');

// Cliente com a chave de servidor. Só corre no backend (Vercel), nunca no site.
module.exports = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

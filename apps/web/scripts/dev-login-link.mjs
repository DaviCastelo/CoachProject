// Utilitário de DEV: gera um link de login (magic link) SEM enviar e-mail.
// Contorna o rate limit do SMTP padrão do Supabase.
//
// Uso (PowerShell), a partir da pasta apps/web:
//   $env:SUPABASE_SERVICE_ROLE_KEY="<sb_secret_... do dashboard>"
//   node scripts/dev-login-link.mjs kairos.tecsuporte@gmail.com
//
// Pré-requisito: a Redirect URL de produção precisa estar liberada no Supabase
// (Authentication -> URL Configuration -> Redirect URLs: https://ca-tempo.vercel.app/**).

import { createClient } from '@supabase/supabase-js';

const email = process.argv[2] || 'kairos.tecsuporte@gmail.com';
const url = process.env.SUPABASE_URL || 'https://dbnoddzaqjgtfnymyqjm.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.SITE_URL || 'https://ca-tempo.vercel.app';

if (!key) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY (a chave sb_secret_... do dashboard).');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo: `${site}/auth/callback` },
});

if (error) {
  console.error('Erro:', error.message);
  process.exit(1);
}

console.log('\n=> Abra este link no navegador para entrar como', email, ':\n');
console.log(data.properties.action_link);
console.log('');

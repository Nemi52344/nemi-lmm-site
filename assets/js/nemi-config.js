/* NEMI · front-end config.
   Supabase Auth handles the email OTP, so there is no server of ours involved.

   These come from: Supabase dashboard -> Project Settings -> API Keys
     Project URL       ->  SUPABASE_URL
     Publishable key   ->  SUPABASE_ANON_KEY

   The publishable key is DESIGNED to be public and safe in browser code. It is
   not a secret. Never put a "secret"/service_role key in this file. */
window.NEMI_CONFIG = {
  SUPABASE_URL: 'https://wrkfxtodkxhhlzmfpvgt.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_FT26jKZMRKO60vR85TLpyQ_QduuLLsu'
};

// ============================================
// vibeOnly — Environment
// ============================================
// The app works with no keys at all: every music source it uses by default
// (Audius, iTunes, Internet Archive, Radio Browser, LRCLIB lyrics) is free and
// keyless. Supabase is optional — fill it in only if you want your own uploads
// and the /admin area. The anon key is safe to publish; Row Level Security
// protects your data.

export const environment = {
  supabase: {
    url: '',
    key: '',
  },
};

export const hasSupabase = (): boolean =>
  /^https:\/\/.+/.test(environment.supabase.url) && environment.supabase.key.length > 20;

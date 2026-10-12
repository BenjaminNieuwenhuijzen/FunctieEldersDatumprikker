import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null als er geen backend is geconfigureerd; de UI valt dan terug op lege staten. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        // Sessie in localStorage van dit origin. 'implicit' zodat een inloglink ook werkt als hij
        // op een ander apparaat/browser wordt geopend dan waar hij is aangevraagd.
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
        },
      })
    : null;

export const turnstileSiteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';

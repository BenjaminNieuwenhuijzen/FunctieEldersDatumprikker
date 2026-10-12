import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null als er geen backend is geconfigureerd; de UI valt dan terug op lege staten. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        // Alleen beheerders loggen in; sessie in localStorage van dit origin.
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

export const turnstileSiteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';

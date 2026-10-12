import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type SessionState = { status: 'loading' } | { status: 'ready'; session: Session | null };

/** Huidige Supabase-sessie (deelnemer of beheerder), live bijgewerkt. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(
    supabase ? { status: 'loading' } : { status: 'ready', session: null },
  );
  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ status: 'ready', session: data.session }));
    const { data } = supabase.auth.onAuthStateChange((_e, session) =>
      setState({ status: 'ready', session }),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}

function authMessage(error: { message?: string; status?: number; code?: string }): string {
  const m = (error.message ?? '').toLowerCase();
  if (error.status === 429 || m.includes('rate limit') || m.includes('seconds'))
    return 'Even geduld: je kunt over een minuut een nieuwe code aanvragen.';
  if (m.includes('expired') || m.includes('invalid') || error.code === 'otp_expired')
    return 'Deze code klopt niet of is verlopen. Vraag een nieuwe aan.';
  if (m.includes('captcha')) return 'De robotcontrole is mislukt. Probeer het opnieuw.';
  if (m.includes('email')) return 'Controleer je e-mailadres.';
  return 'Er ging iets mis. Probeer het opnieuw.';
}

const SAFE_ROUTE = /^\/[a-z0-9/_-]*$/i;

/**
 * Waar de inloglink naartoe terugkeert. HashRouter gebruikt het fragment al, en Supabase zet de
 * sessietokens óók in het fragment; daarom gaat de route mee als query (?next=) en herstelt
 * `completeLinkLogin` hem na het inloggen.
 */
function redirectUrl(): string {
  const route = location.hash.slice(1) || '/';
  const next = SAFE_ROUTE.test(route) ? route : '/';
  return `${location.origin}${import.meta.env.BASE_URL}?next=${encodeURIComponent(next)}`;
}

/**
 * Stuurt een inlogmail (maakt zo nodig een account aan). Afhankelijk van de mailtemplate bevat
 * die een code, een link, of beide; de app ondersteunt alle varianten.
 */
export async function requestCode(email: string, captchaToken?: string): Promise<void> {
  if (!supabase) throw new Error('Inloggen is nog niet beschikbaar.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      captchaToken: captchaToken || undefined,
      emailRedirectTo: redirectUrl(),
    },
  });
  if (error) throw new Error(authMessage(error));
}

export async function verifyCode(email: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Inloggen is nog niet beschikbaar.');
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new Error(authMessage(error));
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export const AUTH_ERROR_KEY = 'fe-auth-error';

/**
 * Verwerkt een terugkeer via de inloglink (vóór de router start): Supabase leest de tokens uit
 * het fragment, daarna zetten we de oorspronkelijke route terug en halen we tokens uit de URL.
 */
export async function completeLinkLogin(): Promise<void> {
  const hash = location.hash.slice(1);
  if (!supabase || !/(^|&)(access_token|error)=/.test(hash)) return;
  const params = new URLSearchParams(hash);
  if (params.get('error')) {
    try {
      sessionStorage.setItem(
        AUTH_ERROR_KEY,
        'Deze inloglink is ongeldig of verlopen. Vraag hieronder een nieuwe aan.',
      );
    } catch {
      /* opslag geblokkeerd: dan alleen geen melding */
    }
  } else {
    await supabase.auth.getSession();
  }
  const next = new URLSearchParams(location.search).get('next') ?? '/';
  history.replaceState(null, '', `${location.pathname}#${SAFE_ROUTE.test(next) ? next : '/'}`);
}

export function takeAuthError(): string {
  try {
    const m = sessionStorage.getItem(AUTH_ERROR_KEY) ?? '';
    sessionStorage.removeItem(AUTH_ERROR_KEY);
    return m;
  } catch {
    return '';
  }
}

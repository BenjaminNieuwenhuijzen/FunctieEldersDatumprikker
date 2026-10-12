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

/** Stuurt een eenmalige code naar het e-mailadres (maakt zo nodig een account aan). */
export async function requestCode(email: string, captchaToken?: string): Promise<void> {
  if (!supabase) throw new Error('Inloggen is nog niet beschikbaar.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken: captchaToken || undefined },
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

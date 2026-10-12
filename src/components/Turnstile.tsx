import { useEffect, useRef } from 'react';
import { turnstileSiteKey } from '../lib/supabase';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Robotcontrole kon niet laden.'));
    document.head.appendChild(s);
  });
  return loading;
}

/** Rendert alleen iets als er een Turnstile site key is geconfigureerd. */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!turnstileSiteKey || !ref.current) return;
    let id: string | undefined;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: turnstileSiteKey,
          theme: 'dark',
          language: 'nl',
          callback: onToken,
          'expired-callback': () => onToken(''),
        });
      })
      .catch(() => onToken(''));
    return () => {
      alive = false;
      if (id) window.turnstile?.remove(id);
    };
  }, [onToken]);
  return turnstileSiteKey ? <div ref={ref} className="min-h-[65px]" /> : null;
}

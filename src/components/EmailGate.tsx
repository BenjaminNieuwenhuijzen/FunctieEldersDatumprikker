import { useEffect, useState, type FormEvent } from 'react';
import { requestCode, takeAuthError, verifyCode } from '../lib/auth';
import { turnstileSiteKey } from '../lib/supabase';
import { Turnstile } from './Turnstile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

/**
 * Twee stappen: e-mailadres → inlogmail. De mail bevat een link en/of een code (afhankelijk van de
 * Supabase-mailtemplate); beide leveren een sessie op.
 */
export function EmailGate({ intro }: { intro?: string }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(takeAuthError);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError('Vul een geldig e-mailadres in.');
    if (turnstileSiteKey && !captcha) return setError('Bevestig even dat je geen robot bent.');
    setBusy(true);
    setError('');
    try {
      await requestCode(clean, captcha);
      setEmail(clean);
      setStep('code');
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6,10}$/.test(code.trim())) return setError('Vul de code uit de e-mail in.');
    setBusy(true);
    setError('');
    try {
      await verifyCode(email, code.trim());
      // De sessie-listener neemt het vanaf hier over.
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-ink p-6 sm:p-10">
      {step === 'email' ? (
        <form onSubmit={sendCode} noValidate className="space-y-5">
          <div>
            <p className="eyebrow">Stap 1 van 2</p>
            <h2 className="mt-2 text-3xl">Bevestig je e-mailadres</h2>
            <p className="mt-3 max-w-xl text-mist">
              {intro ??
                'Je krijgt een inlogmail. Zo telt iedereen één keer mee en kun je later je antwoord aanpassen.'}
            </p>
          </div>
          <div>
            <label htmlFor="eg-email" className="block font-semibold">
              E-mailadres
            </label>
            <input
              id="eg-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="field mt-2 max-w-md"
              value={email}
              maxLength={254}
              aria-invalid={!!error}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Turnstile onToken={setCaptcha} />
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Mail versturen…' : 'Stuur mij een inlogmail'}
          </button>
          <p className="max-w-xl text-sm text-mist">
            Je e-mailadres is nooit publiek en wordt alleen gebruikt om in te loggen. Alleen de
            beheerder kan het zien, bijvoorbeeld om dubbele inzendingen op te ruimen.
          </p>
        </form>
      ) : (
        <form onSubmit={confirm} noValidate className="space-y-5">
          <div>
            <p className="eyebrow">Stap 2 van 2</p>
            <h2 className="mt-2 text-3xl">Check je mail</h2>
            <p className="mt-3 max-w-xl text-mist" aria-live="polite">
              We hebben een mail gestuurd naar <strong className="text-paper">{email}</strong>. Klik
              op de link in die mail, of vul hieronder de code in als de mail een code bevat. Geen
              mail? Kijk ook in je spam.
            </p>
          </div>
          <div>
            <label htmlFor="eg-code" className="block font-semibold">
              Code (als je die hebt gekregen)
            </label>
            <input
              id="eg-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              className="field mt-2 max-w-[12rem] font-mono text-2xl tracking-[0.3em]"
              value={code}
              aria-invalid={!!error}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Controleren…' : 'Bevestigen'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || wait > 0}
              onClick={() => sendCode()}
            >
              {wait > 0 ? `Nieuwe mail over ${wait}s` : 'Stuur nieuwe mail'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
            >
              Ander e-mailadres
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

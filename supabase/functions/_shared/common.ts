// Gedeelde helpers voor de publieke Edge Functions.
// Secrets (automatisch aanwezig of via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   – door Supabase geleverd
//   TURNSTILE_SECRET_KEY                      – optioneel; zodra gezet is CAPTCHA verplicht
//   ALLOWED_ORIGINS                           – optioneel; komma-gescheiden
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import { z } from 'npm:zod@3.23.8';

export { z };

const DEFAULT_ORIGINS = 'https://benjaminnieuwenhuijzen.github.io,http://localhost:5173';
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? DEFAULT_ORIGINS)
  .split(',')
  .map((s) => s.trim());
const MAX_BODY = 8_000;

/** CORS is geen authenticatie; het beperkt alleen welke browsersites de API makkelijk kunnen aanroepen. */
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Vertaalt bekende database-excepties naar nette Nederlandse foutmeldingen. */
const DB_ERRORS: Record<string, [number, string]> = {
  poll_closed: [409, 'Deze poll is gesloten. Stemmen of aanpassen kan niet meer.'],
  not_found: [404, 'Niet gevonden. Controleer je link.'],
  invalid_option: [400, 'Een gekozen datum hoort niet (meer) bij deze poll. Ververs de pagina.'],
  invalid_venue: [400, 'Het gekozen restaurant hoort niet bij deze poll.'],
  invalid_availability: [400, 'Geef bij minstens één datum een geldig antwoord.'],
};

export function dbError(message: string | undefined): HttpError {
  const hit = message ? DB_ERRORS[message] : undefined;
  if (hit) return new HttpError(hit[0], message!, hit[1]);
  // Nooit interne details (of tokens) teruggeven of loggen.
  console.error('db_error');
  return new HttpError(500, 'internal', 'Er ging iets mis. Probeer het later opnieuw.');
}

export function db(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const enc = new TextEncoder();

export async function sha256hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 256 bits willekeur, base64url: niet te raden, veilig in een URL. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{40,64}$/);

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/** Gehashte IP (met secret als zout) zodat er geen ruwe IP-adressen worden opgeslagen. */
async function ipKey(req: Request): Promise<string> {
  return (await sha256hex(`${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}:${clientIp(req)}`)).slice(
    0,
    32,
  );
}

async function rateLimit(
  client: SupabaseClient,
  bucket: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await client.rpc('hit_rate_limit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw dbError(undefined);
  if (data !== true)
    throw new HttpError(429, 'rate_limited', 'Te veel verzoeken. Probeer het later opnieuw.');
}

async function verifyTurnstile(token: string | undefined, req: Request) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return; // Nog niet geconfigureerd: rate limiting + noodstop blijven actief.
  if (!token) throw new HttpError(400, 'captcha_required', 'Bevestig even dat je geen robot bent.');
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  form.append('remoteip', clientIp(req));
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const out = (await res.json()) as { success?: boolean };
  if (!out.success)
    throw new HttpError(400, 'captcha_failed', 'De robotcontrole is mislukt. Probeer het opnieuw.');
}

interface GuardOptions {
  action: string;
  perIpPerHour: number;
  globalPerDay: number;
  captchaToken?: string;
}

/** Noodstop, rate limits (per IP en globaal) en CAPTCHA, in die volgorde. */
export async function guard(req: Request, client: SupabaseClient, o: GuardOptions) {
  const { data: settings } = await client.rpc('get_public_settings');
  if (settings && settings.submissionsEnabled === false) {
    throw new HttpError(
      503,
      'disabled',
      'Inzendingen staan tijdelijk uit. Probeer het later opnieuw.',
    );
  }
  await rateLimit(client, `${o.action}:ip:${await ipKey(req)}`, o.perIpPerHour, 3600);
  await rateLimit(client, `${o.action}:global`, o.globalPerDay, 86400);
  await verifyTurnstile(o.captchaToken, req);
}

/** Standaard request-afhandeling: CORS-preflight, alleen POST, begrensde body, JSON, foutafhandeling. */
export function serve(handler: (req: Request, body: unknown) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
    try {
      const text = await req.text();
      if (text.length > MAX_BODY) throw new HttpError(413, 'too_large', 'Verzoek is te groot.');
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new HttpError(400, 'bad_json', 'Ongeldig verzoek.');
      }
      return await handler(req, body);
    } catch (e) {
      if (e instanceof HttpError) return json(req, e.status, { error: e.code, message: e.message });
      if (e instanceof z.ZodError) {
        return json(req, 400, {
          error: 'invalid',
          message: 'Controleer je invoer en probeer het opnieuw.',
        });
      }
      console.error('unhandled_error');
      return json(req, 500, {
        error: 'internal',
        message: 'Er ging iets mis. Probeer het later opnieuw.',
      });
    }
  });
}

/** Gedeeld schema voor de inhoud van een stem. */
export const voteSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  availability: z
    .record(z.string().uuid(), z.enum(['yes', 'maybe', 'no']))
    .refine((r) => Object.keys(r).length >= 1 && Object.keys(r).length <= 30),
  venueChoice: z.union([z.literal('none'), z.string().uuid()]),
});

export const suggestionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  reason: z.string().trim().max(280).optional().default(''),
  url: z
    .string()
    .trim()
    .max(300)
    .refine((u) => u === '' || /^https?:\/\/[^\s]+$/i.test(u))
    .optional()
    .default(''),
});

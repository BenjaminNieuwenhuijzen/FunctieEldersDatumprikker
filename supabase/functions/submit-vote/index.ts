// Vervallen sinds de overstap op e-mailverificatie: stemmen en wijzigen lopen via de RPC
// cast_vote met een ingelogde (bevestigde) gebruiker. Deze stub geeft 410 Gone.
// Verwijder deze function in het Supabase-dashboard (Edge Functions → submit-vote → Delete).
Deno.serve(
  () =>
    new Response(
      JSON.stringify({
        error: 'gone',
        message: 'Stemmen gaat nu via inloggen met e-mail. Ververs de pagina.',
      }),
      {
        status: 410,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    ),
);

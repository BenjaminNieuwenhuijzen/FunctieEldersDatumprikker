# Beveiliging en privacy

Publieke repo en publieke URL zijn prima. Open schrijfrechten en publieke persoonsdata niet.

## Secrets

| Waarde                             | Waar                         | Publiek?            |
| ---------------------------------- | ---------------------------- | ------------------- |
| `VITE_SUPABASE_URL`                | `.env` / GitHub Actions var  | ja                  |
| `VITE_SUPABASE_PUBLISHABLE_KEY`    | `.env` / GitHub Actions var  | ja (mits RLS klopt) |
| `VITE_TURNSTILE_SITE_KEY`          | `.env` / GitHub Actions var  | ja                  |
| Supabase service-role key          | alleen Edge Function secrets | **nee**             |
| Turnstile secret                   | alleen Edge Function secrets | **nee**             |
| Places-API-key (optioneel, Fase D) | alleen Edge Function secrets | **nee**             |

`.env` staat in `.gitignore`. Alles met `VITE_` komt in de build en is dus publiek.

## Dreigingsmodel en maatregelen (Fase B)

| Risico                       | Maatregel                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Spam/bots                    | Turnstile (server-side geverifieerd), rate limiting, quota, noodstop                       |
| Leesbare individuele stemmen | RLS deny op `participants`, `availability_votes`, `venue_votes`; alleen aggregaten via RPC |
| Stemmen van anderen wijzigen | Opaque edit-token; alleen SHA-256-hash opgeslagen; vergelijking server-side                |
| Admin-misbruik               | Supabase JWT + rol-check in DB/Edge Function; geen `isAdmin` in React                      |
| Stemmen op gesloten poll     | Statuscontrole in Edge Function én in DB-constraint/trigger                                |
| Token-lekkage                | Geen tokens in logs/analytics; `Referrer-Policy: no-referrer`                              |
| Dubbel stemmen               | Niet volledig af te dwingen zonder login; admin beoordeelt duplicaten                      |

## Eerlijke beperking

Zonder accounts is "één stem per persoon" **niet** af te dwingen. De bewerklink voorkomt dat
dezelfde deelnemer dubbel telt, niet dat iemand onder twee namen stemt. Dit staat ook in de UI en
README.

## Privacy

- Verzameld: schermnaam, beschikbaarheid, restaurantkeuze. Geen e-mail, geen cookies, geen analytics.
- Individuele beschikbaarheid is nooit publiek; alleen geaggregeerd.
- Retentie: stemdetails worden 90 dagen na afronding verwijderd (operationele handeling of
  geplande job; zie `OPERATIONS.md`). Niet-persoonlijke bezoekhistorie blijft.
- Privacytekst noemt provider en regio zodra Supabase daadwerkelijk is geconfigureerd.

## Tests (verplicht vóór productie)

Negatieve RLS-tests: anon kan niet lezen/schrijven op ruwe tabellen; fout token kan niet
bewerken; gesloten poll weigert; niet-admin krijgt 403 op admin-endpoints.

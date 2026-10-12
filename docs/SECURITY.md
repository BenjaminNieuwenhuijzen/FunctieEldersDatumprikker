# Beveiliging en privacy

Publieke repo en publieke URL zijn prima. Open schrijfrechten en publieke persoonsdata niet.

## Model

- **Lezen (iedereen)**: uitsluitend 6 security-definer RPC's met niet-persoonlijke data:
  `get_active_event`, `get_public_event`, `get_upcoming_venues`, `get_public_tally` (alleen
  aantallen), `get_public_visits`, `get_public_settings`. Concept-events zijn niet zichtbaar.
- **Stemmen**: alleen met een Supabase-sessie van een **bevestigd e-mailadres** (eenmalige code
  per mail). RPC `cast_vote` gebruikt `auth.uid()`; één deelnemer per e-mailadres per event
  (unique constraint), wijzigen is een upsert en telt dus nooit dubbel.
- **Eigen stem lezen**: `get_my_vote` geeft alleen de stem van de ingelogde gebruiker zelf.
- **Beheer**: dezelfde e-maillogin; rechten uit tabel `admins`, afgedwongen met RLS-policies
  (`is_admin()`) en checks in `admin_list_participants` / `purge_vote_details`. De React-UI
  verbergt alleen knoppen; dat is geen beveiliging.
- **Ruwe tabellen**: RLS aan op alles; anon heeft er geen grants op; ingelogde niet-beheerders
  zien 0 rijen en kunnen niets wijzigen.
- **Functierechten**: nieuwe functies krijgen standaard geen EXECUTE (ook niet voor PUBLIC).

## Secrets

| Waarde                         | Waar                                   | Publiek?      |
| ------------------------------ | -------------------------------------- | ------------- |
| Supabase URL + publishable key | `.env.production` (in repo)            | ja, by design |
| Turnstile site key             | `.env.production`                      | ja            |
| Turnstile secret               | Supabase Auth → Attack Protection      | **nee**       |
| SMTP-wachtwoord (Gmail-app)    | Supabase Auth → SMTP Settings          | **nee**       |
| Service-role key               | alleen Edge Function-omgeving          | **nee**       |
| Database-wachtwoord            | Supabase-dashboard / wachtwoordmanager | **nee**       |

## Dreigingen en maatregelen

| Risico                          | Maatregel                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Spam / bots                     | E-mailverificatie, Auth-rate-limits, optioneel Turnstile, 30 stemacties/uur/gebruiker, noodstop |
| Individuele stemmen uitlezen    | Geen leesrechten op ruwe tabellen; publiek alleen aggregaten                                    |
| Stem van een ander wijzigen     | Upsert op `auth.uid()`; geen ID's of tokens in URL's                                            |
| Admin-misbruik                  | Rol in database; JWT verplicht; RLS op elke tabel                                               |
| Stemmen op gesloten poll        | Statuscheck met rij-lock in `cast_vote`                                                         |
| Kwaadaardige links in ideeën    | DB-constraint: alleen `http(s)://`; links met `rel="noopener noreferrer"`                       |
| CSV-formule-injectie bij export | Cellen die met `= + - @` beginnen worden ge-escaped                                             |
| Lekken via referrer             | `<meta name="referrer" content="no-referrer">`                                                  |

## Eerlijke beperking

Eén stem per **e-mailadres**, niet per persoon: iemand met twee adressen kan twee keer stemmen.
De beheerder ziet e-mailadressen in het aanwezigheidsoverzicht en kan duplicaten verwijderen.

## Privacy

- Verzameld: e-mailadres, schermnaam, beschikbaarheid, restaurantkeuze, optioneel een idee.
- Nooit publiek; alleen beheerders zien namen en e-mailadressen.
- Geen cookies voor tracking, geen analytics. De inlogsessie staat in `localStorage` van de site.
- Data staat bij Supabase in de EU (Frankfurt); mails gaan via de ingestelde SMTP-provider (Gmail).
- Retentie: opschonen 90 dagen na afronding (zie `OPERATIONS.md`).

## Tests

`supabase/tests/rls_negative.sql`: 35 controles (anon, ingelogde gebruiker, onbevestigd adres,
beheerder, noodstop, gesloten poll, functierechten). Laatste run: alle 35 geslaagd.

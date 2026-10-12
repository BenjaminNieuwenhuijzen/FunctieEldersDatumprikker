# Architectuur

## Overzicht

```
Browser (GitHub Pages, statisch)          Supabase (eu-central-1)
  Vite + React + TS + Tailwind   ──────►   Auth: e-mail met eenmalige code (via Resend SMTP)
  HashRouter                               Postgres: RLS op alle tabellen
  supabase-js (publishable key)            RPC's: publieke reads, cast_vote, beheer
                                           Edge Function: submit-suggestion (anoniem idee)
```

- **Frontend**: statisch, gebouwd door GitHub Actions, op
  `https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/` (Vite `base` =
  `/FunctieEldersDatumprikker/`). `HashRouter`: refresh en diepe links werken zonder fallback.
- **Data**: alles in Supabase. Geen Issues/Actions/JSON-bestanden als database.
- **Publiek lezen**: zes security-definer RPC's die alleen niet-persoonlijke data en aggregaten
  teruggeven.
- **Stemmen**: Supabase Auth-sessie na e-mailcode → RPC `cast_vote` (upsert op `auth.uid()`).
- **Beheer**: dezelfde login; tabel `admins` + RLS (`is_admin()`); directe tabeltoegang vanuit de
  beheer-UI is veilig omdat RLS elke rij afschermt.

## Data-laag in de frontend

| Bestand                          | Rol                                                      |
| -------------------------------- | -------------------------------------------------------- |
| `src/lib/api.ts`                 | Interface `PollApi` + `emptyApi` (zonder backend)        |
| `src/lib/supabaseApi.ts`         | Implementatie op Supabase; foutcodes → Nederlandse tekst |
| `src/lib/auth.ts`                | Sessie-hook, code aanvragen/bevestigen, uitloggen        |
| `src/features/admin/adminApi.ts` | Beheeracties (RLS dwingt rechten af)                     |
| `src/lib/demo.ts`                | Alleen `#/design`: gelabelde voorbeelddata               |

## Datamodel

`events`, `event_date_options` (lokale `date` + `time`, geen DST-fouten), `venues`,
`event_venue_options`, `event_exclusions` (event-specifiek uitgesloten), `participants`
(`user_id` → `auth.users`, uniek per event), `availability_votes`, `venue_votes`
("geen voorkeur" = `no_preference`, geen nep-restaurant), `venue_suggestions` (moderatie),
`visits` (bevestigde historie, los van polluitslag), `admins`, `app_settings` (noodstop),
`rate_limits`.

## Mappen

```
src/app          routes, layout
src/components   gedeelde UI (kaarten, route-motief, EmailGate, Turnstile)
src/features/*   events, availability, history, suggestions, admin
src/lib          types, api, auth, validators, format
supabase/        migrations, functions, tests (rls_negative.sql)
docs/            ARCHITECTURE, SECURITY, OPERATIONS, DESIGN, TASKS
```

## Beslissingen

- **E-mailcode i.p.v. bewerklinks** (op verzoek): sterkere één-stem-garantie, geen link om kwijt
  te raken. Vereist eigen SMTP (Resend).
- **Tailwind v4**, geen animatiebibliotheek; **fonts zelf gehost** (geen Google Fonts).
- **Geen analytics, geen trackingcookies.**
- **Geen verzonnen data**: datums en restaurantdetails komen alleen via beheer.

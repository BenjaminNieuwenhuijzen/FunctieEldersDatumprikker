# Architectuur

## Overzicht

```
Browser (GitHub Pages, statisch)  ──►  Supabase
  Vite + React + TS + Tailwind          ├─ Postgres (RLS standaard deny)
  HashRouter                            ├─ Auth (alleen beheerders)
                                        ├─ Storage (optionele historiefoto's)
                                        └─ Edge Functions (publieke schrijfacties)
```

- **Frontend**: volledig statisch, gebouwd door GitHub Actions en gepubliceerd op
  `https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/`
  (Vite `base` = `/FunctieEldersDatumprikker/`).
- **Routing**: `HashRouter`, zodat refresh en diepe links werken zonder Pages-fallback.
- **Data**: Pages kan niets opslaan. Alle gedeelde data staat in Supabase. Geen Issues, Actions
  of JSON-bestanden als database.
- **Publieke leesacties**: alleen via beperkte views/RPC's (actieve events, geaggregeerde
  tussenstanden, goedgekeurde suggesties, bezoeken).
- **Publieke schrijfacties**: uitsluitend via Edge Functions (`submit-vote`, `update-vote`,
  `submit-suggestion`), nooit via directe tabel-inserts.
- **Admin**: Supabase Auth + rol-check server-side (RLS-policy op `admins`, niet alleen in React).

## Data-laag (Fase A → B)

De UI praat uitsluitend met de interface `PollApi` (`src/lib/api.ts`).

| Implementatie | Status                                                 |
| ------------- | ------------------------------------------------------ |
| `emptyApi`    | Fase A. Geen backend: toont lege "datums volgen"-state |
| `demoApi`     | Alleen `#/design`: duidelijk gelabelde voorbeelddata   |
| `supabaseApi` | Fase B, na configuratie van Supabase                   |

Hierdoor kan Fase B worden toegevoegd zonder de schermen te herschrijven.

## Mappen

```
src/app          routes, layout
src/components   gedeelde UI (knoppen, kaarten, route-motief, ...)
src/features/*   events, availability, venues, suggestions, history, admin
src/lib          types, api-interface, validators, config
src/styles       Tailwind-thema (tokens)
supabase/        migrations, functions (Fase B)
docs/            dit document, SECURITY, DESIGN, TASKS, OPERATIONS
```

## Beslissingen

- **Tailwind v4** met CSS-tokens in `src/styles/index.css`; geen animatiebibliotheek (CSS volstaat).
- **Fonts zelf gehost** (`@fontsource-variable`) i.p.v. Google Fonts: geen IP-lek naar derden.
- **Geen analytics, geen cookies.**
- **Event-specifieke blokkades** (FoodExplore, Korean BBQ, La Cubanita) horen bij het event, niet
  bij het restaurant (Fase B/D).
- **Geen verzonnen datums**: datumopties komen uitsluitend uit de beheerinterface.

# Functie Elders — Datumprikker

Een kleine, herbruikbare groepsapp voor etentjes met oud-collega's in de regio Utrecht:
datumprikken, restaurantstemming, geschiedenis en suggesties.

Productie: <https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/>

## Status

| Onderdeel                                                      | Status                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| Frontend, design system (`#/design`), routes, lege/laad-states | werkt (lokaal getest)                                         |
| Stemformulier + validatie + aggregatie                         | werkt in de UI; **opslag nog niet**                           |
| Opslag, bewerklinks, admin, Edge Functions, Turnstile          | **Fase B, nog niet gebouwd** (wacht op Supabase-configuratie) |
| Geschiedenis, suggesties, aanbevelingen                        | Fase C/D, alleen lege schermen                                |

Zonder Supabase toont de site eerlijk "de datums volgen nog". Er zijn geen verzonnen datums.

## Lokaal draaien

```bash
npm install
npm run dev        # http://localhost:5173/FunctieEldersDatumprikker/
npm test           # unit tests
npm run lint
npm run build
```

Kopieer `.env.example` naar `.env` voor Fase B. Alles met `VITE_` is publiek; zet daar nooit geheimen in.

## Deployment (GitHub Pages)

1. Repo → Settings → Pages → **Source: GitHub Actions** (eenmalig, handmatig).
2. Push naar `main`; `.github/workflows/deploy.yml` test, bouwt en publiceert.
3. Later: repository _variables_ (geen secrets) `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_TURNSTILE_SITE_KEY`.

Routing gebruikt `HashRouter`, dus verversen werkt op elk pad.

## Fase B: wat jij handmatig moet doen

1. Supabase-project aanmaken (regio EU). Noteer project-URL en _publishable key_.
2. Cloudflare Turnstile-widget aanmaken; site key is publiek, secret komt in Supabase function secrets.
3. Admin-gebruiker aanmaken in Supabase Auth.
4. Het database-wachtwoord blijft in het Supabase-dashboard / je wachtwoordmanager; het hoort
   nooit in deze repo of in een chat.

## Eerlijke beperking

Zonder accounts is "één stem per persoon" niet af te dwingen. Een persoonlijke bewerklink voorkomt
dubbel tellen van dezelfde deelnemer; de beheerder kan duplicaten opruimen.

## Docs

[Architectuur](docs/ARCHITECTURE.md) · [Beveiliging](docs/SECURITY.md) · [Design](docs/DESIGN.md) · [Takenlijst](docs/TASKS.md)

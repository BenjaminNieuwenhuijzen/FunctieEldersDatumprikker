# Functie Elders — Datumprikker

Een kleine, herbruikbare groepsapp voor etentjes met collega's en oud-collega's in de regio
Utrecht: datumprikken, restaurantstemming, geschiedenis en (later) aanbevelingen.

Productie: <https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/>

## Status

| Onderdeel                                                         | Status                                   |
| ----------------------------------------------------------------- | ---------------------------------------- |
| Frontend, design system (`#/design`), responsive, lege/laadstaten | werkt                                    |
| Database, RLS, publieke lees-RPC's, geschiedenis-tijdlijn         | werkt (35 beveiligingstests geslaagd)    |
| Inloggen met e-mail (link of code), stemmen, wijzigen             | gebouwd; voor de groep na SMTP-setup     |
| Beheer (etentjes, datums, restaurants, aanwezigheid, afronden)    | gebouwd; werkt zodra er een beheerder is |
| Ontdekpagina met ideeën en reacties, aanbevelingen                | Fase C/D                                 |

## Hoe het werkt

- Deelnemers bevestigen hun e-mailadres met een eenmalige code (geen wachtwoord). Daarna kiezen
  ze per datum Ja / Misschien / Nee en een restaurant of "geen voorkeur". Eén stem per
  e-mailadres; terugkomen en opnieuw inloggen = aanpassen.
- Iedereen ziet alleen totalen. Namen en e-mailadressen zijn alleen zichtbaar voor beheerders.
- Beheer via `#/admin` met dezelfde e-maillogin; rechten staan in de database.

**Eerlijke beperking:** één stem per e-mailadres, niet per persoon. De beheerder kan duplicaten
opruimen.

## Lokaal draaien

```bash
npm install
npm run dev        # http://localhost:5173/FunctieEldersDatumprikker/
npm test
npm run lint
npm run build
```

`.env.development` en `.env.production` bevatten alleen publieke waarden (Supabase-URL en
publishable key). Zet daar nooit geheimen in.

## Deployment

Push naar `main` → GitHub Actions test, bouwt en publiceert naar Pages (Settings → Pages →
Source: GitHub Actions). Routing via `HashRouter`, dus verversen werkt op elke pagina.

## Handmatige stappen

Zie [docs/OPERATIONS.md](docs/OPERATIONS.md): Gmail-SMTP, e-mailtemplates met code,
eerste beheerder, en het verwijderen van twee vervallen Edge Functions.

## Docs

[Architectuur](docs/ARCHITECTURE.md) · [Beveiliging](docs/SECURITY.md) ·
[Operations](docs/OPERATIONS.md) · [Design](docs/DESIGN.md) · [Takenlijst](docs/TASKS.md)

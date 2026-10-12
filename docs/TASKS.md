# Takenlijst

Legenda: ✅ klaar en getest · 🧪 gebouwd, nog niet end-to-end getest · ⏳ wacht op handmatige configuratie

## Fase A — Repo en designfundament

- ✅ Repo, base path `/FunctieEldersDatumprikker/`, Pages-workflow, lint/format/tests
- ✅ Design system `#/design`, responsive layout (geen horizontaal scrollen op 375px)

## Fase B — Echte datumprikker

- ✅ Schema + RLS + RPC's in Supabase (migrations in `supabase/migrations/`)
- ✅ 35 database-beveiligingstests geslaagd
- ✅ Publieke pagina's lezen echte data (home, event, geschiedenis)
- 🧪 Inloggen met e-mailcode → stemmen → wijzigen (⏳ SMTP via Gmail, zie OPERATIONS 1b)
- 🧪 Beheer: etentjes, datums, restaurants, openen/sluiten, aanwezigheid, CSV, afronden,
  suggesties modereren, noodstop, opschonen (⏳ eerste beheerder, OPERATIONS 1c)
- ⏳ Turnstile (optioneel)

## Fase C — Groepsarchief

- ✅ Tabel `visits` + publieke tijdlijn; eerste bezoek (Daebak, 27-03-2026) vastgelegd
- Ontdekpagina met goedgekeurde ideeën + "lijkt me leuk / niks"-reacties
- Optionele foto's (Supabase Storage)

## Fase D — Aanbevelingen · Fase E — Afwerking

Zie implementatieplan. Event-specifieke uitsluitingen (FoodExplore, Daebak, La Cubanita) staan al
in `event_exclusions` voor de ranker.

Context voor de ranker (locatie/reistijd): de groep bestaat uit collega's en oud-collega's van
Unified, later overgenomen door Previder. Previder zit in **Vianen**; een deel van de groep werkt
daar nog. Ankerpunten voor "goed bereikbaar": Utrecht (centrum/station) en Vianen.

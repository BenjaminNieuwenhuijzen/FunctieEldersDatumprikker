# Takenlijst

Legenda: ✅ klaar en werkend · 🧪 UI/mock · ⏳ wacht op externe configuratie

## Fase A — Repo en designfundament

- ✅ Repo-inspectie, base path `/FunctieEldersDatumprikker/`
- ✅ Docs: ARCHITECTURE, SECURITY, DESIGN
- ✅ Vite + React + TS strict + Tailwind v4 + HashRouter
- ✅ Lint, Prettier, Vitest
- 🧪 Design-systempagina `#/design` met voorbeelddata
- 🧪 Home, event, ontdek, geschiedenis, admin-placeholder
- ✅ GitHub Actions Pages-workflow (⏳ Pages Source = GitHub Actions instellen)

## Fase B — Echte datumprikker

- ⏳ Supabase-project + Turnstile aanmaken (zie README)
- Migrations + RLS + RLS-tests
- Edge Functions: submit-vote, update-vote
- `supabaseApi`, admin-login, eventbeheer, poll sluiten
- Aggregaten via RPC

## Fase C — Groepsarchief · Fase D — Aanbevelingen · Fase E — Afwerking

Zie implementatieplan.

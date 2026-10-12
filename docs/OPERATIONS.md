# Operations

Supabase-project: `ukzmcgpkzbgrdvlvtzqh` (regio eu-central-1, Frankfurt).
Productie: <https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/>

## 1. Eenmalige handmatige configuratie

Deze stappen kan alleen de eigenaar doen (accounts, secrets, dashboardinstellingen).

### 1a. Resend (verstuurt de inlogcodes)

De ingebouwde mail van Supabase stuurt alleen naar leden van de eigen Supabase-organisatie en
heeft een zeer lage limiet. Voor deelnemers is een eigen SMTP-provider dus verplicht.

1. Maak een account op <https://resend.com>.
2. **Domains → Add domain**: voeg een domein toe dat je bezit (bijv. `mail.jouwdomein.nl`) en zet de
   getoonde DNS-records (SPF/DKIM) bij je domeinregistrar. Wacht tot de status _Verified_ is.
   Zonder eigen domein kan Resend alleen naar je eigen adres mailen; gebruik dan Brevo als alternatief.
3. **API Keys → Create API key** met alleen _Sending access_. Bewaar hem in je wachtwoordmanager.

### 1b. Supabase Auth

Dashboard → **Authentication**:

1. **Emails → SMTP Settings → Enable custom SMTP**
   - Sender email: bijv. `etentje@mail.jouwdomein.nl` · Sender name: `Functie Elders`
   - Host `smtp.resend.com` · Port `465` · Username `resend` · Password: de Resend API key
2. **Emails → Templates → Magic Link** (deze template wordt ook voor codes gebruikt). Onderwerp
   `Je code voor Functie Elders` en als inhoud bijvoorbeeld:

   ```html
   <h2>Je inlogcode</h2>
   <p>Vul deze code in op de datumprikker van Functie Elders:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Heb je dit niet aangevraagd? Dan kun je deze mail negeren.</p>
   ```

   Belangrijk: `{{ .Token }}` moet erin staan, anders krijgen mensen een link in plaats van een code.

3. **Sign In / Providers → Email**: _Enable Email provider_ aan, _Confirm email_ aan.
   Email OTP expiration: 600 seconden (10 minuten) is prima.
4. **URL Configuration → Site URL**:
   `https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/`
5. **Rate Limits**: _Emails sent per hour_ bijv. 60 (na het instellen van SMTP aanpasbaar).
6. Optioneel, aanbevolen vóór breed delen: **Attack Protection → Enable Captcha protection** met
   Cloudflare Turnstile. Maak een Turnstile-widget op <https://dash.cloudflare.com> (hostname
   `benjaminnieuwenhuijzen.github.io` en `localhost`), zet de _secret key_ hier in Supabase, en de
   _site key_ (publiek) in `.env.production` als `VITE_TURNSTILE_SITE_KEY`.

### 1c. Eerste beheerder

1. Open `#/admin` op de site en log in met je eigen e-mailadres (code uit de mail).
2. Je ziet "Geen beheerrechten". Voer dan in de Supabase **SQL Editor** uit (vul je e-mail in):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'jouw@email.nl';
   ```

3. Ververs `#/admin`. Extra beheerders voeg je op dezelfde manier toe.

### 1d. Opruimen

Edge Functions → verwijder `submit-vote` en `update-vote` (vervallen; geven nu 410).

## 2. Een etentje organiseren

1. `#/admin` → **Etentjes** → kies of maak een etentje.
2. Voeg datumopties toe en vink de restaurants aan ("Geen voorkeur" staat er automatisch bij).
3. **Poll openen** → kopieer de publieke link en deel die (bijv. in WhatsApp).
4. Volg de uitslag en aanwezigheid; verwijder zo nodig dubbele inzendingen.
5. **Poll sluiten** → daarna kan niemand meer stemmen of wijzigen.
6. Na het etentje: **Afronden** met de werkelijke datum en het restaurant. Dit zet het bezoek in de
   geschiedenis. Niets wordt automatisch afgeleid uit de stemming.

## 3. Noodstop bij spam

`#/admin` → **Instellingen** → _Inzendingen uitzetten_. Lezen blijft werken. Of via SQL:

```sql
update public.app_settings set value = 'false' where key = 'submissions_enabled';
```

Daarnaast: per gebruiker max. 30 stemacties per uur en 5 restaurantideeën per dag; Supabase Auth
begrenst het aantal codes per e-mailadres en per uur.

## 4. Privacy en retentie

- Persoonsgegevens: e-mailadres (Supabase Auth), schermnaam en antwoorden. Nooit publiek.
- Advies: 90 dagen na afronding opschonen via `#/admin` → **Instellingen** → _Opschonen_. Dit
  verwijdert deelnemers van afgeronde etentjes en ongebruikte accounts; de bezoekhistorie blijft.
- Een individueel verzoek tot verwijdering: verwijder de deelnemer in het aanwezigheidsoverzicht,
  en het account in Authentication → Users.

## 5. Back-ups en export

- Aanwezigheid per etentje: `#/admin` → etentje → _Exporteer CSV_.
- Volledige database: Supabase Dashboard → Database → Backups (dagelijks op betaalde plannen), of
  `supabase db dump` met de CLI.

## 6. Migrations en tests

- Migrations staan in `supabase/migrations/` en zijn al toegepast op het project. Nieuwe wijziging:
  nieuw bestand met tijdstempel, toepassen via `supabase db push` (CLI) of de SQL Editor.
- Beveiligingstests: voer `supabase/tests/rls_negative.sql` uit in de SQL Editor. Elke rij moet
  `ok = true` zijn; het script rolt alles terug.
- Nieuwe databasefuncties krijgen standaard **geen** EXECUTE-rechten (zie migration
  `fix_function_grants`). Geef ze expliciet aan `authenticated` of `anon` als dat de bedoeling is,
  en werk de laatste test in `rls_negative.sql` bij.

## 7. Kosten

- Supabase Free: geen kosten zolang het project binnen de gratis limieten blijft. Inactieve gratis
  projecten worden na een week gepauzeerd; wekken kan in het dashboard.
- Resend Free: ruim voldoende voor een groep van ~12 personen.
- GitHub Pages: gratis voor publieke repositories.
- Er is geen betaalde restaurant-API gekoppeld.

## 8. Problemen oplossen

| Symptoom                    | Oorzaak / oplossing                                                  |
| --------------------------- | -------------------------------------------------------------------- |
| Geen mail met code          | SMTP niet ingesteld (1a/1b), spamfolder, of Auth-rate-limit bereikt. |
| Mail bevat link i.p.v. code | `{{ .Token }}` ontbreekt in de Magic Link-template (1b-2).           |
| "Geen beheerrechten"        | Account staat niet in `public.admins` (1c).                          |
| Poll niet zichtbaar         | Status is nog _Concept_; open de poll in beheer.                     |
| Site toont oude versie      | GitHub Actions-run nog bezig of mislukt (tab _Actions_ in de repo).  |
| Project gepauzeerd (Free)   | Supabase Dashboard → project → _Restore_.                            |

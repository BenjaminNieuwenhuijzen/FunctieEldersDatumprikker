# Operations

Supabase-project: `ukzmcgpkzbgrdvlvtzqh` (regio eu-central-1, Frankfurt).
Productie: <https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/>

## 1. Eenmalige handmatige configuratie

Deze stappen kan alleen de eigenaar doen (accounts, secrets, dashboardinstellingen).

### 1a. Status (12-10-2026)

Al ingesteld: Site URL = productie-URL; Redirect URLs =
`https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/**` en `http://localhost:5173/**`.

Zonder eigen SMTP gebruikt Supabase de standaardmail. Die stuurt **alleen naar leden van de eigen
Supabase-organisatie** (dus de eigenaar), met een zeer lage limiet en een **inloglink** (templates
zijn pas aan te passen met eigen SMTP). De app ondersteunt die link, dus de beheerder kan al
inloggen. Voor de groep is eigen SMTP nodig (1b).

### 1b. Gmail als mailprovider (geen eigen domein nodig)

1. Zet tweestapsverificatie aan op het Google-account dat de mails verstuurt.
2. Maak een **app-wachtwoord**: <https://myaccount.google.com/apppasswords> (naam bijv.
   "Supabase Functie Elders"). Bewaar het in je wachtwoordmanager.
3. Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - Sender email: je Gmail-adres · Sender name: `Functie Elders`
   - Host `smtp.gmail.com` · Port `465` · Username: je Gmail-adres · Password: het app-wachtwoord
4. **Emails → Templates**: pas zowel **Magic link or OTP** als **Confirm sign up** aan (nieuwe
   deelnemers krijgen de laatste). Onderwerp `Inloggen bij Functie Elders`, inhoud bijvoorbeeld:

   ```html
   <h2>Inloggen bij Functie Elders</h2>
   <p>Vul deze code in op de datumprikker:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Of klik op deze link: <a href="{{ .ConfirmationURL }}">inloggen</a></p>
   <p>Heb je dit niet aangevraagd? Dan kun je deze mail negeren.</p>
   ```

   Met code én link werkt het ook als iemand de mail op een ander apparaat leest.

5. **Rate Limits**: _Emails sent per hour_ bijv. 60. Gmail staat ca. 500 mails per dag toe.
6. Optioneel, aanbevolen vóór breed delen: **Attack Protection → Enable Captcha protection** met
   Cloudflare Turnstile. Secret key in Supabase, site key (publiek) in `.env.production` als
   `VITE_TURNSTILE_SITE_KEY`.

Alternatief met eigen domein: Resend (`smtp.resend.com`, poort 465, gebruiker `resend`, wachtwoord =
API key) na het verifiëren van het domein.

### 1c. Eerste beheerder

1. Open `#/admin` op de site en log in met je eigen e-mailadres (link of code uit de mail).
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

## 2b. Ontdek-pagina (automatische suggesties)

- **Bron:** OpenStreetMap via de Overpass API (gratis, ODbL; bronvermelding staat op de pagina).
- **Automatisch:** pg_cron-job `discover-venues-hourly` roept elk uur de Edge Function
  `discover-venues` aan. Die haalt restaurants op binnen 4 km van Utrecht Centraal en 2,5 km van
  Vianen, maar slaat over als er in de laatste 20 uur al een geslaagde ronde was. Overpass-servers
  zijn soms overbelast; dan probeert de job het een uur later opnieuw. Plekken blijven 21 dagen
  zichtbaar en worden na 60 dagen zonder update verwijderd.
- **Status bekijken:** `select * from discover_runs order by id desc limit 5;`
- **Handmatig starten:** `curl -X POST https://ukzmcgpkzbgrdvlvtzqh.supabase.co/functions/v1/discover-venues`
  (doet niets als er minder dan 20 uur geleden een geslaagde ronde was).
- **Ranking:** deterministisch in `src/features/suggestions/ranker.ts` (getest): nieuw voor de
  groep, andere keuken dan eerdere etentjes en de kandidaten, seizoen, terras (lente/zomer),
  loopafstand tot Utrecht Centraal of in Vianen, vegetarisch, en de 👍/👎-stemmen.
- **Geen Google-API:** sterren en reviews staan achter de knop "Google-reviews bekijken" (gewone
  Google Maps-link). Foto's zijn gestileerde keukenillustraties. Google Places kan later worden
  toegevoegd (vereist Google Cloud met betaalgegevens).
- **Kaart:** Leaflet met OpenStreetMap-tegels (donker gemaakt met CSS). Geen sleutel nodig.
- **Tips van de beheerder:** toevoegen via SQL in `venue_suggestions` met `source = 'admin'`,
  `status = 'approved'` (zie migration `suggestion_votes`). Ideeën van deelnemers komen binnen als
  `pending` en worden goedgekeurd in `#/admin` → Suggesties.
- **Stemmen:** één 👍 of 👎 per ingelogde persoon per plek (`suggestion_votes`), aanpasbaar en in
  te trekken; los van de formele stemming voor een etentje.

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
- Beveiligingstests: voer `supabase/tests/rls_negative.sql` en `supabase/tests/votes.sql` uit in de SQL Editor. Elke rij moet
  `ok = true` zijn; het script rolt alles terug.
- Nieuwe databasefuncties krijgen standaard **geen** EXECUTE-rechten (zie migration
  `fix_function_grants`). Geef ze expliciet aan `authenticated` of `anon` als dat de bedoeling is,
  en werk de laatste test in `rls_negative.sql` bij.

## 7. Kosten

- Supabase Free: geen kosten zolang het project binnen de gratis limieten blijft. Inactieve gratis
  projecten worden na een week gepauzeerd; wekken kan in het dashboard.
- Gmail-SMTP: gratis, ca. 500 mails per dag; ruim voldoende voor ~12 personen.
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

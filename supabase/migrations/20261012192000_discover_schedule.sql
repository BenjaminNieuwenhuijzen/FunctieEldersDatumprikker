-- Planning voor het automatisch bijwerken van de Ontdek-catalogus.
-- Elk uur een poging; de Edge Function slaat zelf over als er in de afgelopen 20 uur al een
-- geslaagde ronde was. Zo is er dagelijks verse data én een snelle herkansing als de (gratis,
-- soms overbelaste) Overpass-servers niet reageren.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'discover-venues-hourly',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://ukzmcgpkzbgrdvlvtzqh.supabase.co/functions/v1/discover-venues',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

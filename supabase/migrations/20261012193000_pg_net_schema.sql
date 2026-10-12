-- Advisor: extensie pg_net niet in het public-schema. De functies staan altijd in schema "net",
-- dus de cron-job (net.http_post) blijft ongewijzigd werken.
drop extension if exists pg_net;
create extension pg_net schema extensions;

-- Locatie en officiële website van de door de beheerder aangeleverde suggesties, gekoppeld aan
-- OpenStreetMap (gecontroleerd op naam + straat, 12-10-2026).
update public.venue_suggestions s set osm_ref = v.ref, lat = v.lat, lon = v.lon, url = coalesce(s.url, v.url)
from (values
  ('LE:EN', 'node/1311822401', 52.0752219, 5.121412, 'https://leen-restaurant.nl/'),
  ('Miyagi & Jones Utrecht', 'node/12051546216', 52.0867556, 5.1063672, 'https://utrecht.miyagiandjones.nl/'),
  ('''t Zusje Utrecht', 'node/2709754363', 52.0961606, 5.1164048, 'https://zusje.nl/onze-zusjes/utrecht/'),
  ('Mooie Boules Utrecht', 'node/2722190550', 52.0962042, 5.0830386, 'https://mooieboules.nl/utrecht/'),
  ('Umami', 'node/1985576979', 52.0943613, 5.1168841, 'http://umamiutrecht.nl'),
  ('Restaurant Carmel Market', 'node/945890579', 52.0930289, 5.1222547, 'https://carmelmarket.nl/')
) as v(name, ref, lat, lon, url)
where s.suggested_name = v.name and s.source = 'admin';

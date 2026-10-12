-- Op verzoek van de beheerder (12-10-2026): de zes tips worden ook keuzes in de stemming van het
-- tweede etentje, naast Heinde en IXI. Gegevens zoals aangeleverd + locatie/website uit OSM.
insert into public.venues (slug, name, city, cuisine_tags, website_url, description, lat, lon, source)
select v.slug, v.name, 'Utrecht', v.tags, s.url,
       concat_ws(' ', case when s.price_note ~ '\.$' then s.price_note else s.price_note || '.' end, s.reason),
       s.lat, s.lon, 'suggestion'
from (values
  ('leen-utrecht', 'LE:EN', 'LE:EN', array['Aziatisch', 'Shared dining']),
  ('miyagi-jones-utrecht', 'Miyagi & Jones', 'Miyagi & Jones Utrecht', array['Aziatisch', 'Streetfood']),
  ('t-zusje-utrecht', '''t Zusje', '''t Zusje Utrecht', array['Tapas', 'Onbeperkt']),
  ('mooie-boules-utrecht', 'Mooie Boules', 'Mooie Boules Utrecht', array['Shared dining', 'Activiteiten']),
  ('umami-utrecht', 'Umami', 'Umami', array['Aziatisch', 'All-you-can-eat']),
  ('carmel-market-utrecht', 'Carmel Market', 'Restaurant Carmel Market', array['Mediterraan', 'Shared dining'])
) as v(slug, name, suggestion_name, tags)
join public.venue_suggestions s on s.suggested_name = v.suggestion_name and s.source = 'admin'
on conflict (slug) do nothing;

insert into public.event_venue_options (event_id, venue_id, position)
select e.id, v.id, 2 + row_number() over (order by v.name)
from public.events e
cross join public.venues v
where e.slug = 'tweede-etentje'
  and v.slug in ('leen-utrecht', 'miyagi-jones-utrecht', 't-zusje-utrecht', 'mooie-boules-utrecht',
                 'umami-utrecht', 'carmel-market-utrecht')
on conflict do nothing;

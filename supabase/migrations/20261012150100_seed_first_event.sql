-- Startdata: alleen wat de opdrachtgever heeft bevestigd. Geen verzonnen datums, prijzen of links.
insert into public.venues (slug, name, city) values
  ('heinde-utrecht', 'Heinde', 'Utrecht'),
  ('ixi-utrecht', 'IXI Restaurant', 'Utrecht');

-- Concept-event: niet publiek zichtbaar tot de beheerder datums toevoegt en de poll opent.
insert into public.events (slug, title, status) values ('eerste-etentje', 'Het eerste etentje', 'draft');

insert into public.event_venue_options (event_id, venue_id, position)
select e.id, v.id, case v.slug when 'heinde-utrecht' then 0 else 1 end
from public.events e cross join public.venues v
where e.slug = 'eerste-etentje' and v.slug in ('heinde-utrecht', 'ixi-utrecht');

-- Event-specifiek uitgesloten (niet universeel).
insert into public.event_exclusions (event_id, label, reason)
select e.id, x.label, 'Uitgesloten voor het eerste etentje'
from public.events e cross join (values ('FoodExplore'), ('Korean BBQ'), ('La Cubanita')) as x (label)
where e.slug = 'eerste-etentje';

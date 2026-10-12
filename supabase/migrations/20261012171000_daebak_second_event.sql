-- Bevestigd door de beheerder: het eerste etentje was bij Daebak (Korean BBQ) in Utrecht.
-- Het komende etentje is daarmee het tweede. Bezoekdatum volgt (historie, Fase C).
insert into public.venues (slug, name, city, cuisine_tags)
values ('daebak-utrecht', 'Daebak', 'Utrecht', array['Koreaans', 'BBQ']);

update public.event_exclusions x
set label = 'Daebak (Korean BBQ)',
    venue_id = (select id from public.venues where slug = 'daebak-utrecht'),
    reason = 'Al bezocht bij het eerste etentje'
from public.events e
where x.event_id = e.id and e.slug = 'eerste-etentje' and x.label = 'Korean BBQ';

update public.events
set slug = 'tweede-etentje', title = 'Het tweede etentje', updated_at = now()
where slug = 'eerste-etentje';

update public.event_exclusions x
set reason = 'Uitgesloten voor het tweede etentje'
from public.events e
where x.event_id = e.id and e.slug = 'tweede-etentje' and x.reason = 'Uitgesloten voor het eerste etentje';

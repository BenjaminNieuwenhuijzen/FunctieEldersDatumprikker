-- Gegevens van Heinde en IXI, gecontroleerd op de officiële websites (12-10-2026):
-- https://heinde.nl/locatie/utrecht/ en https://www.ixirestaurant.nl/
-- Locatie IXI uit OpenStreetMap; Heinde op basis van het adres Oosterkade 30.
update public.venues set
  cuisine_tags = array['Onbeperkt tafelen', 'Kleine gerechtjes'],
  website_url = 'https://heinde.nl/locatie/utrecht/',
  description = 'Onbeperkt tafelen voor een vaste prijs: de hele avond zo vaak kiezen uit kleine gerechtjes als je wilt. € 37,50 p.p. (ma–do) of € 42,50 p.p. (vr–zo). Vanaf tien personen kan een deel van het restaurant voor de groep worden gereserveerd. Oosterkade 30, vlak bij parkeergarage Vaartsche Rijn. Let op: geen toegankelijk toilet.',
  lat = 52.078987, lon = 5.123042,
  verified_at = now()
where slug = 'heinde-utrecht';

update public.venues set
  cuisine_tags = array['Aziatisch', 'Sushi', 'All you can taste'],
  website_url = 'https://www.ixirestaurant.nl/',
  description = 'All You Can Taste-diner van 2,5 uur: onbeperkt kiezen uit ruim 130 gerechten, van sushi en sashimi tot Aziatische fusion, warme gerechten en grillspecialiteiten. Veilinghavenkade 115-127, met vegetarische opties.',
  lat = 52.0828139, lon = 5.1080579,
  verified_at = now()
where slug = 'ixi-utrecht';

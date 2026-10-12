-- Locatie (niet persoonlijk) meegeven in de publieke restaurantgegevens, voor de kaart.
create or replace function public._venue_json(v public.venues) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', v.id, 'slug', v.slug, 'name', v.name, 'city', v.city, 'cuisineTags', to_jsonb(v.cuisine_tags),
    'websiteUrl', v.website_url, 'description', v.description, 'priceBand', v.price_band,
    'lat', v.lat, 'lon', v.lon, 'verifiedAt', v.verified_at))
$$;
revoke execute on function public._venue_json(public.venues) from public, anon, authenticated;

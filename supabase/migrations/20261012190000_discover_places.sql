-- Ontdek: automatisch bijgewerkte restaurantcatalogus uit OpenStreetMap (ODbL, bron vermelden).
-- Een Edge Function haalt dagelijks restaurants rond Utrecht Centraal en Vianen op; de ranking
-- gebeurt deterministisch en uitlegbaar in de frontend (src/features/suggestions/ranker.ts).

create table public.discover_places (
  osm_ref text primary key check (osm_ref ~ '^(node|way|relation)/[0-9]+$'),
  name text not null check (char_length(name) between 1 and 160),
  cuisines text[] not null default '{}',
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  street text,
  housenumber text,
  postcode text,
  city text,
  website text check (website is null or website ~ '^https?://'),
  outdoor_seating boolean,
  wheelchair text,
  diets text[] not null default '{}',
  opening_hours text,
  area text not null check (area in ('utrecht', 'vianen')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index on public.discover_places (last_seen_at);

create table public.discover_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error', 'skipped')),
  place_count integer,
  source text,
  message text check (char_length(message) <= 500)
);
create index on public.discover_runs (started_at desc);

alter table public.discover_places enable row level security;
alter table public.discover_runs enable row level security;
revoke all on public.discover_places, public.discover_runs from anon;
create policy admin_read on public.discover_places for select to authenticated using ((select public.is_admin()));
create policy admin_read on public.discover_runs for select to authenticated using ((select public.is_admin()));

-- Publiek: actuele plekken (gezien in de laatste 21 dagen). Geen persoonsgegevens.
create function public.get_discover_places() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'ref', p.osm_ref, 'name', p.name, 'cuisines', to_jsonb(p.cuisines), 'lat', p.lat, 'lon', p.lon,
    'street', p.street, 'housenumber', p.housenumber, 'postcode', p.postcode, 'city', p.city,
    'website', p.website, 'outdoorSeating', p.outdoor_seating, 'wheelchair', p.wheelchair,
    'diets', to_jsonb(p.diets), 'openingHours', p.opening_hours, 'area', p.area,
    'firstSeenAt', p.first_seen_at)) order by p.name), '[]'::jsonb)
  from public.discover_places p
  where p.last_seen_at > now() - interval '21 days'
$$;

-- Publiek: wanneer is de lijst voor het laatst bijgewerkt + uitsluitingen van het komende etentje.
create function public.get_discover_meta() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'updatedAt', (select max(finished_at) from public.discover_runs where status = 'ok'),
    'exclusions', coalesce((
      select jsonb_agg(x.label) from public.event_exclusions x
      where x.event_id = (select id from public.events where status <> 'completed'
                          order by created_at desc limit 1)), '[]'::jsonb))
$$;

-- Alleen voor de Edge Function (service role): beslissen of er opnieuw opgehaald mag worden.
create function public.discover_should_run(p_min_hours integer default 20) returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.discover_runs
    where (status = 'ok' and finished_at > now() - make_interval(hours => p_min_hours))
       or (status = 'running' and started_at > now() - interval '10 minutes'))
$$;

create function public.discover_start_run() returns bigint
language sql security definer set search_path = ''
as $$ insert into public.discover_runs (status) values ('running') returning id $$;

-- Upsert van een volledige ophaalronde. p_places: array van objecten zoals get_discover_places.
create function public.discover_finish_run(
  p_run_id bigint, p_status text, p_places jsonb, p_source text, p_message text
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer := 0;
begin
  if p_status = 'ok' and jsonb_typeof(p_places) = 'array' then
    insert into public.discover_places as d (osm_ref, name, cuisines, lat, lon, street, housenumber,
      postcode, city, website, outdoor_seating, wheelchair, diets, opening_hours, area, last_seen_at)
    select x.ref, left(x.name, 160), coalesce(x.cuisines, '{}'), x.lat, x.lon, left(x.street, 160),
      left(x.housenumber, 20), left(x.postcode, 12), left(x.city, 80),
      case when x.website ~ '^https?://' then left(x.website, 300) end,
      x."outdoorSeating", left(x.wheelchair, 20), coalesce(x.diets, '{}'), left(x."openingHours", 300),
      x.area, now()
    from jsonb_to_recordset(p_places) as x(ref text, name text, cuisines text[], lat double precision,
      lon double precision, street text, housenumber text, postcode text, city text, website text,
      "outdoorSeating" boolean, wheelchair text, diets text[], "openingHours" text, area text)
    where x.ref ~ '^(node|way|relation)/[0-9]+$' and x.name is not null and x.area in ('utrecht', 'vianen')
    on conflict (osm_ref) do update set
      name = excluded.name, cuisines = excluded.cuisines, lat = excluded.lat, lon = excluded.lon,
      street = excluded.street, housenumber = excluded.housenumber, postcode = excluded.postcode,
      city = excluded.city, website = excluded.website, outdoor_seating = excluded.outdoor_seating,
      wheelchair = excluded.wheelchair, diets = excluded.diets, opening_hours = excluded.opening_hours,
      area = excluded.area, last_seen_at = now();
    get diagnostics n = row_count;
    -- Opruimen: plekken die al 60 dagen niet meer in OSM voorkomen (waarschijnlijk gesloten).
    delete from public.discover_places where last_seen_at < now() - interval '60 days';
  end if;
  update public.discover_runs
  set finished_at = now(), status = p_status, place_count = n, source = left(p_source, 100),
      message = left(p_message, 500)
  where id = p_run_id;
  delete from public.discover_runs where started_at < now() - interval '90 days';
  return n;
end $$;

revoke execute on function public.get_discover_places(), public.get_discover_meta(),
  public.discover_should_run(integer), public.discover_start_run(),
  public.discover_finish_run(bigint, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.get_discover_places(), public.get_discover_meta() to anon, authenticated;
grant execute on function public.discover_should_run(integer), public.discover_start_run(),
  public.discover_finish_run(bigint, text, jsonb, text, text) to service_role;

-- Functie Elders — kernschema, RLS en RPC's.
-- Uitgangspunt: RLS standaard deny. Publiek leest uitsluitend via security-definer RPC's
-- (aggregaten, niet-persoonlijke eventdata). Publiek schrijft uitsluitend via Edge Functions
-- die de *_tx-functies met de service role aanroepen. Beheerders werken via RLS + is_admin().

-- ─── Tabellen ──────────────────────────────────────────────────────────────

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 1 and 120),
  city text not null default 'Utrecht' check (char_length(city) between 1 and 80),
  cuisine_tags text[] not null default '{}',
  website_url text check (website_url is null or (website_url ~ '^https?://' and char_length(website_url) <= 300)),
  description text check (char_length(description) <= 600),
  price_band smallint check (price_band between 1 and 4),
  lat double precision,
  lon double precision,
  source text not null default 'manual' check (source in ('manual', 'suggestion', 'external')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'completed')),
  timezone text not null default 'Europe/Amsterdam',
  -- Pas invullen na handmatig besluit; nooit afgeleid uit de stemming.
  starts_at timestamptz,
  decided_venue_id uuid references public.venues (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_date_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- Lokale kalenderdatum + tijd (Europe/Amsterdam), bewust geen timestamptz: geen DST-verschuiving.
  local_date date not null,
  start_time time,
  label text check (char_length(label) <= 80),
  unique nulls not distinct (event_id, local_date, start_time)
);
create index on public.event_date_options (event_id);

create table public.event_venue_options (
  event_id uuid not null references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete restrict,
  position smallint not null default 0,
  primary key (event_id, venue_id)
);
create index on public.event_venue_options (venue_id);

-- Event-specifieke blokkades (bijv. "niet voor het eerste etentje"); geen universele ban.
create table public.event_exclusions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  venue_id uuid references public.venues (id) on delete cascade,
  reason text check (char_length(reason) <= 280)
);
create index on public.event_exclusions (event_id);
create index on public.event_exclusions (venue_id);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  -- SHA-256 (hex) van de bewerkcode; de code zelf wordt nooit opgeslagen.
  edit_token_hash text not null unique check (edit_token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.participants (event_id);

create table public.availability_votes (
  participant_id uuid not null references public.participants (id) on delete cascade,
  date_option_id uuid not null references public.event_date_options (id) on delete cascade,
  response text not null check (response in ('yes', 'maybe', 'no')),
  primary key (participant_id, date_option_id)
);
create index on public.availability_votes (date_option_id);

create table public.venue_votes (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete restrict,
  no_preference boolean not null default false,
  check ((venue_id is null) = no_preference)
);
create index on public.venue_votes (event_id);
create index on public.venue_votes (venue_id);

create table public.venue_suggestions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  suggested_name text not null check (char_length(btrim(suggested_name)) between 1 and 80),
  submitted_by_label text check (char_length(submitted_by_label) <= 40),
  reason text check (char_length(reason) <= 280),
  url text check (url is null or (url ~ '^https?://' and char_length(url) <= 300)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'duplicate')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index on public.venue_suggestions (status, created_at desc);
create index on public.venue_suggestions (event_id);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- Noodstop voor alle publieke inzendingen.
insert into public.app_settings (key, value) values ('submissions_enabled', 'true');

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);
create index on public.rate_limits (window_start);

-- ─── Autorisatie ───────────────────────────────────────────────────────────

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;

do $$
declare t text;
begin
  foreach t in array array['venues','events','event_date_options','event_venue_options',
    'event_exclusions','participants','availability_votes','venue_votes','venue_suggestions',
    'admins','app_settings','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- Anon heeft op ruwe tabellen niets te zoeken: ook geen grants (defense in depth naast RLS).
    execute format('revoke all on public.%I from anon', t);
  end loop;
  foreach t in array array['venues','events','event_date_options','event_venue_options',
    'event_exclusions','participants','availability_votes','venue_votes','venue_suggestions',
    'app_settings']
  loop
    execute format(
      'create policy admin_all on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- Admins zien de admin-lijst, maar beheren die niet via de API (alleen via SQL/dashboard).
create policy admin_read on public.admins for select to authenticated using ((select public.is_admin()));
-- rate_limits: geen policies → alleen service role / security definer.

-- ─── Interne helpers ───────────────────────────────────────────────────────

create function public._venue_json(v public.venues) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', v.id, 'slug', v.slug, 'name', v.name, 'city', v.city, 'cuisineTags', to_jsonb(v.cuisine_tags),
    'websiteUrl', v.website_url, 'description', v.description, 'priceBand', v.price_band,
    'verifiedAt', v.verified_at))
$$;

create function public._event_json(e public.events) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'title', e.title, 'status', e.status, 'timezone', e.timezone,
    'startsAt', e.starts_at,
    'dateOptions', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', d.id, 'localDate', d.local_date, 'startTime', to_char(d.start_time, 'HH24:MI'),
        'label', d.label)) order by d.local_date, d.start_time)
      from public.event_date_options d where d.event_id = e.id), '[]'::jsonb),
    'venues', coalesce((
      select jsonb_agg(public._venue_json(v) order by o.position, v.name)
      from public.event_venue_options o join public.venues v on v.id = o.venue_id
      where o.event_id = e.id), '[]'::jsonb))
$$;

create function public._validate_vote(
  p_event_id uuid, p_availability jsonb, p_venue_id uuid, p_no_preference boolean
) returns void
language plpgsql stable set search_path = ''
as $$
declare r record; n int := 0;
begin
  if jsonb_typeof(p_availability) is distinct from 'object' then raise exception 'invalid_availability'; end if;
  for r in select key, value from jsonb_each_text(p_availability) loop
    if r.value not in ('yes', 'maybe', 'no') then raise exception 'invalid_availability'; end if;
    if not exists (select 1 from public.event_date_options
                   where id = r.key::uuid and event_id = p_event_id) then
      raise exception 'invalid_option';
    end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'invalid_availability'; end if;
  if p_no_preference then
    if p_venue_id is not null then raise exception 'invalid_venue'; end if;
  elsif p_venue_id is null or not exists (
    select 1 from public.event_venue_options where event_id = p_event_id and venue_id = p_venue_id) then
    raise exception 'invalid_venue';
  end if;
end $$;

-- ─── Publieke RPC's (alleen-lezen, geen persoonsgegevens) ───────────────────

create function public.get_active_event() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select public._event_json(e) from public.events e
  where e.status in ('open', 'closed')
  order by (e.status = 'open') desc, e.created_at desc limit 1
$$;

create function public.get_public_event(p_slug text) returns jsonb
language sql stable security definer set search_path = ''
as $$ select public._event_json(e) from public.events e where e.slug = p_slug and e.status <> 'draft' $$;

-- Kandidaat-restaurants van het eerstvolgende (nog niet afgeronde) event, ook in concept.
create function public.get_upcoming_venues() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(public._venue_json(v) order by o.position, v.name), '[]'::jsonb)
  from public.event_venue_options o join public.venues v on v.id = o.venue_id
  where o.event_id = (select id from public.events where status <> 'completed'
                      order by created_at desc limit 1)
$$;

create function public.get_public_tally(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when not exists (select 1 from public.events where id = p_event_id and status <> 'draft')
  then null else jsonb_build_object(
    'participantCount', (select count(*) from public.participants where event_id = p_event_id),
    'dates', coalesce((
      select jsonb_object_agg(x.id, x.t) from (
        select d.id, jsonb_build_object(
          'yes', count(a.response) filter (where a.response = 'yes'),
          'maybe', count(a.response) filter (where a.response = 'maybe'),
          'no', count(a.response) filter (where a.response = 'no')) as t
        from public.event_date_options d
        left join public.availability_votes a on a.date_option_id = d.id
        where d.event_id = p_event_id group by d.id) x), '{}'::jsonb),
    'venues', (
      select jsonb_object_agg(y.k, y.n) from (
        select o.venue_id::text as k,
               (select count(*) from public.venue_votes vv
                where vv.event_id = p_event_id and vv.venue_id = o.venue_id) as n
        from public.event_venue_options o where o.event_id = p_event_id
        union all
        select 'none', (select count(*) from public.venue_votes vv
                        where vv.event_id = p_event_id and vv.no_preference)) y))
  end
$$;

create function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('submissionsEnabled',
    coalesce((select value = 'true'::jsonb from public.app_settings where key = 'submissions_enabled'), true))
$$;

create function public.am_i_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_admin() $$;

-- ─── Schrijf-transacties (alleen service role, via Edge Functions) ──────────

create function public.submit_vote_tx(
  p_event_id uuid, p_display_name text, p_token_hash text,
  p_availability jsonb, p_venue_id uuid, p_no_preference boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_status text; v_pid uuid;
begin
  select status into v_status from public.events where id = p_event_id for share;
  if v_status is null then raise exception 'not_found'; end if;
  if v_status <> 'open' then raise exception 'poll_closed'; end if;
  perform public._validate_vote(p_event_id, p_availability, p_venue_id, p_no_preference);

  insert into public.participants (event_id, display_name, edit_token_hash)
  values (p_event_id, btrim(p_display_name), p_token_hash) returning id into v_pid;
  insert into public.availability_votes (participant_id, date_option_id, response)
  select v_pid, key::uuid, value from jsonb_each_text(p_availability);
  insert into public.venue_votes (participant_id, event_id, venue_id, no_preference)
  values (v_pid, p_event_id, p_venue_id, p_no_preference);
  return v_pid;
end $$;

create function public.load_vote_tx(p_token_hash text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'eventId', e.id, 'eventSlug', e.slug, 'displayName', p.display_name,
    'availability', coalesce((select jsonb_object_agg(a.date_option_id, a.response)
                              from public.availability_votes a where a.participant_id = p.id), '{}'::jsonb),
    'venueChoice', (select coalesce(vv.venue_id::text, 'none')
                    from public.venue_votes vv where vv.participant_id = p.id))
  from public.participants p join public.events e on e.id = p.event_id
  where p.edit_token_hash = p_token_hash
$$;

create function public.update_vote_tx(
  p_token_hash text, p_display_name text,
  p_availability jsonb, p_venue_id uuid, p_no_preference boolean
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_pid uuid; v_event uuid; v_status text;
begin
  select id, event_id into v_pid, v_event from public.participants
  where edit_token_hash = p_token_hash for update;
  if v_pid is null then raise exception 'not_found'; end if;
  select status into v_status from public.events where id = v_event for share;
  if v_status <> 'open' then raise exception 'poll_closed'; end if;
  perform public._validate_vote(v_event, p_availability, p_venue_id, p_no_preference);

  update public.participants set display_name = btrim(p_display_name), updated_at = now() where id = v_pid;
  delete from public.availability_votes where participant_id = v_pid;
  insert into public.availability_votes (participant_id, date_option_id, response)
  select v_pid, key::uuid, value from jsonb_each_text(p_availability);
  update public.venue_votes set venue_id = p_venue_id, no_preference = p_no_preference
  where participant_id = v_pid;
end $$;

create function public.submit_suggestion_tx(
  p_event_id uuid, p_name text, p_by text, p_reason text, p_url text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.venue_suggestions (event_id, suggested_name, submitted_by_label, reason, url)
  values (p_event_id, btrim(p_name), nullif(btrim(p_by), ''), nullif(btrim(p_reason), ''), nullif(btrim(p_url), ''))
  returning id into v_id;
  return v_id;
end $$;

create function public.hit_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (bucket, window_start, hits) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return v_hits <= p_limit;
end $$;

-- Retentie: verwijdert namen + stemdetails van afgeronde events (bezoekhistorie blijft).
create function public.purge_vote_details(p_older_than_days integer default 90) returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.participants p using public.events e
  where p.event_id = e.id and e.status = 'completed'
    and e.completed_at < now() - make_interval(days => p_older_than_days);
  get diagnostics n = row_count;
  return n;
end $$;

-- ─── Execute-rechten ───────────────────────────────────────────────────────

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function public.get_active_event(), public.get_public_event(text),
  public.get_upcoming_venues(), public.get_public_tally(uuid), public.get_public_settings()
  to anon, authenticated;
grant execute on function public.is_admin(), public.am_i_admin(), public.purge_vote_details(integer)
  to authenticated;
grant execute on function public.submit_vote_tx(uuid, text, text, jsonb, uuid, boolean),
  public.load_vote_tx(text), public.update_vote_tx(text, text, jsonb, uuid, boolean),
  public.submit_suggestion_tx(uuid, text, text, text, text),
  public.hit_rate_limit(text, integer, integer)
  to service_role;

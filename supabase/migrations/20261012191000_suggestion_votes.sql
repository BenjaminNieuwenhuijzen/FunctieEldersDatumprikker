-- Stemmen op suggesties (van deelnemers, de beheerder én automatische suggesties uit OSM).
-- Eén stem per persoon (geverifieerd e-mailadres) per suggestie: 👍 of 👎, aanpasbaar of in te trekken.
-- Losstaand van de formele restaurantstemming van een etentje.

alter table public.venue_suggestions
  add column source text not null default 'participant' check (source in ('participant', 'admin')),
  add column cuisine_label text check (char_length(cuisine_label) <= 60),
  add column price_note text check (char_length(price_note) <= 80),
  add column osm_ref text check (osm_ref is null or osm_ref ~ '^(node|way|relation)/[0-9]+$'),
  add column lat double precision check (lat between -90 and 90),
  add column lon double precision check (lon between -180 and 180);

create table public.suggestion_votes (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('suggestion', 'place')),
  target_id text not null check (char_length(target_id) between 1 and 64),
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index on public.suggestion_votes (target_type, target_id);

alter table public.suggestion_votes enable row level security;
revoke all on public.suggestion_votes from anon;
create policy admin_read on public.suggestion_votes for select to authenticated using ((select public.is_admin()));
create policy admin_delete on public.suggestion_votes for delete to authenticated using ((select public.is_admin()));

-- Publiek: goedgekeurde suggesties (zonder e-mailadressen of user-id's).
create function public.get_public_suggestions() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', s.id, 'name', s.suggested_name, 'reason', s.reason, 'url', s.url,
    'cuisineLabel', s.cuisine_label, 'priceNote', s.price_note, 'source', s.source,
    'submittedBy', s.submitted_by_label, 'osmRef', s.osm_ref, 'lat', s.lat, 'lon', s.lon,
    'createdAt', s.created_at)) order by s.created_at desc), '[]'::jsonb)
  from public.venue_suggestions s
  where s.status = 'approved'
$$;

-- Publiek: alleen aantallen per doel, nooit wie er stemde.
create function public.get_vote_tallies() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, t), '{}'::jsonb) from (
    select v.target_type || ':' || v.target_id as k,
           jsonb_build_object('up', count(*) filter (where v.value = 1),
                              'down', count(*) filter (where v.value = -1)) as t
    from public.suggestion_votes v group by v.target_type, v.target_id) x
$$;

-- Eigen stemmen van de ingelogde gebruiker.
create function public.get_my_votes() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_object_agg(v.target_type || ':' || v.target_id, v.value), '{}'::jsonb)
  from public.suggestion_votes v where v.user_id = auth.uid()
$$;

-- Stem uitbrengen (1 / -1) of intrekken (0). Eén rij per gebruiker per doel.
create function public.vote_suggestion(p_target_type text, p_target_id text, p_value integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public._require_verified_user();
begin
  if coalesce((select value = 'false'::jsonb from public.app_settings where key = 'submissions_enabled'), false) then
    raise exception 'submissions_disabled';
  end if;
  if not public.hit_rate_limit('vote:' || v_uid, 120, 3600) then raise exception 'rate_limited'; end if;
  if p_value not in (-1, 0, 1) then raise exception 'invalid_vote'; end if;

  if p_target_type = 'suggestion' then
    if p_target_id !~ '^[0-9a-f-]{36}$' or not exists (
      select 1 from public.venue_suggestions where id = p_target_id::uuid and status = 'approved') then
      raise exception 'not_found';
    end if;
  elsif p_target_type = 'place' then
    if not exists (select 1 from public.discover_places where osm_ref = p_target_id) then
      raise exception 'not_found';
    end if;
  else
    raise exception 'invalid_vote';
  end if;

  if p_value = 0 then
    delete from public.suggestion_votes
    where user_id = v_uid and target_type = p_target_type and target_id = p_target_id;
  else
    insert into public.suggestion_votes (user_id, target_type, target_id, value)
    values (v_uid, p_target_type, p_target_id, p_value)
    on conflict (user_id, target_type, target_id)
      do update set value = excluded.value, updated_at = now();
  end if;

  return (select jsonb_build_object(
    'up', count(*) filter (where value = 1), 'down', count(*) filter (where value = -1))
    from public.suggestion_votes where target_type = p_target_type and target_id = p_target_id);
end $$;

-- Een idee insturen vanaf de Ontdek-pagina (ingelogd; wordt pas publiek na goedkeuring).
create function public.submit_my_suggestion(p_name text, p_reason text, p_url text, p_label text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public._require_verified_user();
begin
  if coalesce((select value = 'false'::jsonb from public.app_settings where key = 'submissions_enabled'), false) then
    raise exception 'submissions_disabled';
  end if;
  if (select count(*) from public.venue_suggestions
      where submitted_by_user = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limited';
  end if;
  begin
    insert into public.venue_suggestions (suggested_name, reason, url, submitted_by_label, submitted_by_user)
    values (btrim(p_name), nullif(btrim(coalesce(p_reason, '')), ''), nullif(btrim(coalesce(p_url, '')), ''),
            nullif(btrim(coalesce(p_label, '')), ''), v_uid);
  exception when check_violation or not_null_violation then
    raise exception 'invalid_suggestion';
  end;
end $$;

revoke execute on function public.get_public_suggestions(), public.get_vote_tallies(),
  public.get_my_votes(), public.vote_suggestion(text, text, integer),
  public.submit_my_suggestion(text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_public_suggestions(), public.get_vote_tallies() to anon, authenticated;
grant execute on function public.get_my_votes(), public.vote_suggestion(text, text, integer),
  public.submit_my_suggestion(text, text, text, text) to authenticated;

-- Door de beheerder aangeleverd (12-10-2026). Prijzen en beschrijving zoals aangeleverd;
-- locatie wordt gekoppeld aan OpenStreetMap zodra die plek in de catalogus staat.
insert into public.venue_suggestions
  (suggested_name, cuisine_label, price_note, reason, submitted_by_label, source, status, reviewed_at)
values
  ('LE:EN', 'Aziatische shared dining', 'Vanaf € 35 p.p. voor het dinermenu',
   'Industriële, creatieve locatie met street-art en Aziatische fusion. Kleine gerechten, veel vegetarische opties en een ontspannen sfeer. Het verrassingsmenu kan vanaf zes personen; online reserveren tot 22 personen.',
   'Beheerder', 'admin', 'approved', now()),
  ('Miyagi & Jones Utrecht', 'Asian streetfood', '€ 43,50 p.p. voor drie gangen',
   'Sushi, dumplings, vlees, vis en Aziatische streetfood met een westerse twist. Alles om te delen, met cocktails en speciaalbier. Geen Korean BBQ of onbeperkt eten, wel een vergelijkbaar sociaal eetconcept.',
   'Beheerder', 'admin', 'approved', now()),
  ('''t Zusje Utrecht', 'Onbeperkt tapas', 'Vanaf € 43,80 p.p.',
   'Sluit misschien het best aan op Heinde. Iedereen kiest twee gerechtjes per ronde, er is geen vaste eindtijd en veel keuze. Vanaf tien personen zijn er ook drankarrangementen.',
   'Beheerder', 'admin', 'approved', now()),
  ('Mooie Boules Utrecht', 'Shared dining + activiteiten', '€ 24,50 p.p. voor shared dining',
   'De wildcard: eerst samen eten, daarna jeu de boules, shuffleboard of karaoke. Arrangementen vanaf elf personen, dus de groep past precies in het concept.',
   'Beheerder', 'admin', 'approved', now()),
  ('Umami', 'Aziatisch all-you-can-eat', 'Circa € 40–50 p.p.',
   'Midden aan de Oudegracht. Sushi, yakitori, tempura en wokgerechten als all-you-can-eat, verdeeld over twee verdiepingen met ruimte voor grote gezelschappen. Een sterk alternatief voor IXI in hartje centrum.',
   'Beheerder', 'admin', 'approved', now()),
  ('Restaurant Carmel Market', 'Mediterrane shared dining', 'À la carte',
   'Sfeervolle zaak op het Janskerkhof met invloeden uit Libanon, Israël, Griekenland en Noord-Afrika: warme flatbreads, hummus en vlees-, vis- en groentegerechten om te delen. Een heel andere keuken dan Daebak en IXI.',
   'Beheerder', 'admin', 'approved', now());

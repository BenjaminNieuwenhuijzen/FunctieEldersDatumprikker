-- Twee fasen per etentje (op verzoek van de beheerder):
--   1. Restaurant kiezen: iedereen stemt op een restaurant; de datumprikker zit op slot.
--   2. Datum prikken: de beheerder legt het restaurant vast (decided_venue_id) en zet
--      dates_open aan; dan stemt iedereen alleen nog over datums.
-- Afgedwongen in de database: wie in de verkeerde fase stemt, krijgt een fout.

alter table public.events add column dates_open boolean not null default false;

-- Datumopties en het gekozen restaurant pas publiek als de datumprikker open is.
create or replace function public._event_json(e public.events) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'title', e.title, 'status', e.status, 'timezone', e.timezone,
    'startsAt', e.starts_at,
    'datesOpen', e.dates_open,
    'decidedVenue', case when e.dates_open or e.status = 'completed' then
      (select public._venue_json(v) from public.venues v where v.id = e.decided_venue_id) end,
    'dateOptions', case when e.dates_open then coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', d.id, 'localDate', d.local_date, 'startTime', to_char(d.start_time, 'HH24:MI'),
        'label', d.label)) order by d.local_date, d.start_time)
      from public.event_date_options d where d.event_id = e.id), '[]'::jsonb) else '[]'::jsonb end,
    'venues', coalesce((
      select jsonb_agg(public._venue_json(v) order by o.position, v.name)
      from public.event_venue_options o join public.venues v on v.id = o.venue_id
      where o.event_id = e.id), '[]'::jsonb))
$$;
revoke execute on function public._event_json(public.events) from public, anon, authenticated;

create or replace function public.get_public_tally(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when not exists (select 1 from public.events where id = p_event_id and status <> 'draft')
  then null else jsonb_build_object(
    'participantCount', (select count(*) from public.participants where event_id = p_event_id),
    'dates', case when (select dates_open from public.events where id = p_event_id) then coalesce((
      select jsonb_object_agg(x.id, x.t) from (
        select d.id, jsonb_build_object(
          'yes', count(a.response) filter (where a.response = 'yes'),
          'maybe', count(a.response) filter (where a.response = 'maybe'),
          'no', count(a.response) filter (where a.response = 'no')) as t
        from public.event_date_options d
        left join public.availability_votes a on a.date_option_id = d.id
        where d.event_id = p_event_id group by d.id) x), '{}'::jsonb) else '{}'::jsonb end,
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

-- Gemeenschappelijke start van een inzending: login, noodstop, rate limit, event-lock.
create function public._begin_submission(p_event_id uuid, p_display_name text)
returns table (uid uuid, dates_open boolean, participant_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public._require_verified_user(); v_status text; v_dates boolean; v_pid uuid;
begin
  if coalesce((select value = 'false'::jsonb from public.app_settings where key = 'submissions_enabled'), false) then
    raise exception 'submissions_disabled';
  end if;
  if not public.hit_rate_limit('cast:' || v_uid, 30, 3600) then raise exception 'rate_limited'; end if;
  select e.status, e.dates_open into v_status, v_dates from public.events e where e.id = p_event_id for share;
  if v_status is null then raise exception 'not_found'; end if;
  if v_status <> 'open' then raise exception 'poll_closed'; end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 40 then
    raise exception 'invalid_name';
  end if;
  insert into public.participants (event_id, user_id, display_name)
  values (p_event_id, v_uid, btrim(p_display_name))
  on conflict (event_id, user_id)
    do update set display_name = excluded.display_name, updated_at = now()
  returning id into v_pid;
  return query select v_uid, v_dates, v_pid;
end $$;

-- Fase 1: restaurantstem (+ optioneel idee). Kan alleen zolang de datumprikker dicht is.
create function public.cast_venue_vote(
  p_event_id uuid, p_display_name text, p_venue_id uuid, p_no_preference boolean,
  p_suggestion jsonb default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare s record;
begin
  select * into s from public._begin_submission(p_event_id, p_display_name);
  if s.dates_open then raise exception 'venue_phase_closed'; end if;
  if p_no_preference then
    if p_venue_id is not null then raise exception 'invalid_venue'; end if;
  elsif p_venue_id is null or not exists (
    select 1 from public.event_venue_options where event_id = p_event_id and venue_id = p_venue_id) then
    raise exception 'invalid_venue';
  end if;

  insert into public.venue_votes (participant_id, event_id, venue_id, no_preference)
  values (s.participant_id, p_event_id, p_venue_id, p_no_preference)
  on conflict (participant_id)
    do update set venue_id = excluded.venue_id, no_preference = excluded.no_preference;

  if nullif(btrim(coalesce(p_suggestion ->> 'name', '')), '') is not null then
    if (select count(*) from public.venue_suggestions
        where submitted_by_user = s.uid and created_at > now() - interval '1 day') >= 5 then
      raise exception 'rate_limited';
    end if;
    begin
      insert into public.venue_suggestions
        (event_id, suggested_name, submitted_by_label, reason, url, submitted_by_user)
      values (p_event_id, btrim(p_suggestion ->> 'name'), btrim(p_display_name),
              nullif(btrim(coalesce(p_suggestion ->> 'reason', '')), ''),
              nullif(btrim(coalesce(p_suggestion ->> 'url', '')), ''), s.uid);
    exception when check_violation then
      raise exception 'invalid_suggestion';
    end;
  end if;
end $$;

-- Fase 2: beschikbaarheid per datum. Kan alleen als de datumprikker open is.
create function public.cast_availability(p_event_id uuid, p_display_name text, p_availability jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare s record; r record; n int := 0;
begin
  select * into s from public._begin_submission(p_event_id, p_display_name);
  if not s.dates_open then raise exception 'dates_locked'; end if;
  if jsonb_typeof(p_availability) is distinct from 'object' then raise exception 'invalid_availability'; end if;
  for r in select key, value from jsonb_each_text(p_availability) loop
    if r.value not in ('yes', 'maybe', 'no') then raise exception 'invalid_availability'; end if;
    if not exists (select 1 from public.event_date_options where id = r.key::uuid and event_id = p_event_id) then
      raise exception 'invalid_option';
    end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'invalid_availability'; end if;

  delete from public.availability_votes where participant_id = s.participant_id;
  insert into public.availability_votes (participant_id, date_option_id, response)
  select s.participant_id, key::uuid, value from jsonb_each_text(p_availability);
end $$;

-- De oude gecombineerde functie vervalt.
drop function public.cast_vote(uuid, text, jsonb, uuid, boolean, jsonb);
drop function public._validate_vote(uuid, jsonb, uuid, boolean);

revoke execute on function public._begin_submission(uuid, text) from public, anon, authenticated;
revoke execute on function public.cast_venue_vote(uuid, text, uuid, boolean, jsonb),
  public.cast_availability(uuid, text, jsonb) from public, anon;
grant execute on function public.cast_venue_vote(uuid, text, uuid, boolean, jsonb),
  public.cast_availability(uuid, text, jsonb) to authenticated;

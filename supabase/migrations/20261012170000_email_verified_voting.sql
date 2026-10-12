-- Stemmen vereist een geverifieerd e-mailadres (Supabase Auth, e-mail met eenmalige code).
-- Eén stem per e-mailadres per event; wijzigen = opnieuw inloggen. Bewerklinks vervallen.
-- E-mailadressen staan alleen in auth.users en zijn uitsluitend voor beheerders zichtbaar.

drop function public.submit_vote_tx(uuid, text, text, jsonb, uuid, boolean);
drop function public.load_vote_tx(text);
drop function public.update_vote_tx(text, text, jsonb, uuid, boolean);

-- Er zijn nog geen stemmen; veilig om de kolom te vervangen.
alter table public.participants drop column edit_token_hash;
alter table public.participants
  add column user_id uuid not null references auth.users (id) on delete cascade;
alter table public.participants
  add constraint participants_event_user_key unique (event_id, user_id);
create index on public.participants (user_id);

alter table public.venue_suggestions
  add column submitted_by_user uuid references auth.users (id) on delete set null;
create index on public.venue_suggestions (submitted_by_user);

-- Huidige gebruiker, alleen als het e-mailadres bevestigd is.
create function public._require_verified_user() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from auth.users where id = v and email_confirmed_at is not null) then
    raise exception 'email_not_verified';
  end if;
  return v;
end $$;

-- Nieuwe stem of wijziging (upsert): telt altijd één keer per e-mailadres.
create function public.cast_vote(
  p_event_id uuid, p_display_name text, p_availability jsonb,
  p_venue_id uuid, p_no_preference boolean, p_suggestion jsonb default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public._require_verified_user(); v_status text; v_pid uuid;
begin
  if coalesce((select value = 'false'::jsonb from public.app_settings where key = 'submissions_enabled'), false) then
    raise exception 'submissions_disabled';
  end if;
  if not public.hit_rate_limit('cast:' || v_uid, 30, 3600) then raise exception 'rate_limited'; end if;

  select status into v_status from public.events where id = p_event_id for share;
  if v_status is null then raise exception 'not_found'; end if;
  if v_status <> 'open' then raise exception 'poll_closed'; end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 40 then
    raise exception 'invalid_name';
  end if;
  perform public._validate_vote(p_event_id, p_availability, p_venue_id, p_no_preference);

  insert into public.participants (event_id, user_id, display_name)
  values (p_event_id, v_uid, btrim(p_display_name))
  on conflict (event_id, user_id)
    do update set display_name = excluded.display_name, updated_at = now()
  returning id into v_pid;

  delete from public.availability_votes where participant_id = v_pid;
  insert into public.availability_votes (participant_id, date_option_id, response)
  select v_pid, key::uuid, value from jsonb_each_text(p_availability);

  insert into public.venue_votes (participant_id, event_id, venue_id, no_preference)
  values (v_pid, p_event_id, p_venue_id, p_no_preference)
  on conflict (participant_id)
    do update set venue_id = excluded.venue_id, no_preference = excluded.no_preference;

  -- Optioneel restaurantidee: gemodereerde suggestie, geen polloptie.
  if nullif(btrim(coalesce(p_suggestion ->> 'name', '')), '') is not null then
    if (select count(*) from public.venue_suggestions
        where submitted_by_user = v_uid and created_at > now() - interval '1 day') >= 5 then
      raise exception 'rate_limited';
    end if;
    begin
      insert into public.venue_suggestions
        (event_id, suggested_name, submitted_by_label, reason, url, submitted_by_user)
      values (p_event_id, btrim(p_suggestion ->> 'name'), btrim(p_display_name),
              nullif(btrim(coalesce(p_suggestion ->> 'reason', '')), ''),
              nullif(btrim(coalesce(p_suggestion ->> 'url', '')), ''), v_uid);
    exception when check_violation then
      raise exception 'invalid_suggestion';
    end;
  end if;
end $$;

-- Eigen stem (alleen voor de ingelogde gebruiker zelf) + laatst gebruikte naam.
create function public.get_my_vote(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'lastDisplayName', (select display_name from public.participants
                        where user_id = auth.uid() order by updated_at desc limit 1),
    'vote', (
      select jsonb_build_object(
        'displayName', p.display_name,
        'availability', coalesce((select jsonb_object_agg(a.date_option_id, a.response)
                                  from public.availability_votes a where a.participant_id = p.id), '{}'::jsonb),
        'venueChoice', (select coalesce(vv.venue_id::text, 'none')
                        from public.venue_votes vv where vv.participant_id = p.id))
      from public.participants p where p.event_id = p_event_id and p.user_id = auth.uid()))
  end
$$;

-- Aanwezigheidsoverzicht voor beheerders, inclusief e-mail (voor duplicaten/herstel).
create function public.admin_list_participants(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'displayName', p.display_name, 'email', u.email,
      'createdAt', p.created_at, 'updatedAt', p.updated_at,
      'availability', coalesce((select jsonb_object_agg(a.date_option_id, a.response)
                                from public.availability_votes a where a.participant_id = p.id), '{}'::jsonb),
      'venueChoice', (select coalesce(vv.venue_id::text, 'none')
                      from public.venue_votes vv where vv.participant_id = p.id))
      order by p.created_at)
    from public.participants p join auth.users u on u.id = p.user_id
    where p.event_id = p_event_id), '[]'::jsonb);
end $$;

-- Retentie: ook accounts (e-mailadressen) opruimen die nergens meer aan gekoppeld zijn.
create or replace function public.purge_vote_details(p_older_than_days integer default 90) returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.participants p using public.events e
  where p.event_id = e.id and e.status = 'completed'
    and e.completed_at < now() - make_interval(days => p_older_than_days);
  get diagnostics n = row_count;
  delete from auth.users u
  where not exists (select 1 from public.participants p where p.user_id = u.id)
    and not exists (select 1 from public.admins a where a.user_id = u.id)
    and coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => p_older_than_days);
  return n;
end $$;

revoke execute on function public._require_verified_user() from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, text, jsonb, uuid, boolean, jsonb),
  public.get_my_vote(uuid), public.admin_list_participants(uuid)
  to authenticated;

-- Beveiligingstests (positief én negatief). Draait in één transactie en rolt alles terug.
-- Uitvoeren: plak in de Supabase SQL editor (of via MCP execute_sql). Elke rij moet ok = true zijn.
begin;

-- ── Testdata (als postgres) ──
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@test.invalid', now(), now(), now()),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@test.invalid', now(), now(), now()),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'c@test.invalid', null,  now(), now()),
  ('00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'd@test.invalid', now(), now(), now());
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000d');

insert into public.events (slug, title, status) values ('rls-test', 'RLS-test', 'open');
insert into public.event_date_options (event_id, local_date)
  select id, date '2099-01-01' from public.events where slug = 'rls-test';
insert into public.event_venue_options (event_id, venue_id)
  select e.id, v.id from public.events e, public.venues v where e.slug = 'rls-test' and v.slug = 'heinde-utrecht';

create function pg_temp.t(name text, ok boolean) returns void language sql as $$
  select set_config('t.results', current_setting('t.results', true) || format('%s|%s;', name, ok), true) $$;
-- ID's vooraf als postgres vastleggen: testrollen kunnen de ruwe tabellen (terecht) niet lezen.
select set_config('t.ev', (select id::text from public.events where slug = 'rls-test'), true);
select set_config('t.d1', (select d.id::text from public.event_date_options d
  join public.events e on e.id = d.event_id where e.slug = 'rls-test'), true);
select set_config('t.heinde', (select id::text from public.venues where slug = 'heinde-utrecht'), true);
select set_config('t.ixi', (select id::text from public.venues where slug = 'ixi-utrecht'), true);
create function pg_temp.ev() returns uuid language sql as $$ select current_setting('t.ev')::uuid $$;
create function pg_temp.d1() returns text language sql as $$ select current_setting('t.d1') $$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true) $$;
-- Functies krijgen standaard geen EXECUTE meer voor PUBLIC; testhelpers expliciet vrijgeven.
grant execute on function pg_temp.t(text, boolean), pg_temp.ev(), pg_temp.d1(), pg_temp.as_user(text) to public;
select set_config('t.results', '', true);

-- ── Anon ──
set local role anon;
do $$
begin
  begin perform 1 from public.participants; perform pg_temp.t('anon: participants niet leesbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: participants niet leesbaar', true); end;
  begin perform 1 from public.availability_votes; perform pg_temp.t('anon: availability_votes niet leesbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: availability_votes niet leesbaar', true); end;
  begin perform 1 from public.venue_votes; perform pg_temp.t('anon: venue_votes niet leesbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: venue_votes niet leesbaar', true); end;
  begin perform 1 from public.venue_suggestions; perform pg_temp.t('anon: suggesties niet direct leesbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: suggesties niet direct leesbaar', true); end;
  begin perform 1 from public.admins; perform pg_temp.t('anon: admins niet leesbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: admins niet leesbaar', true); end;
  begin perform 1 from public.visits; perform pg_temp.t('anon: visits niet direct leesbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: visits niet direct leesbaar', true); end;
  begin update public.events set status = 'closed'; perform pg_temp.t('anon: kan event niet wijzigen', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: kan event niet wijzigen', true); end;
  begin perform public.cast_venue_vote(pg_temp.ev(), 'x', null, true);
        perform pg_temp.t('anon: cast_venue_vote niet aanroepbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: cast_venue_vote niet aanroepbaar', true); end;
  begin perform public.cast_availability(pg_temp.ev(), 'x', jsonb_build_object(pg_temp.d1(), 'yes'));
        perform pg_temp.t('anon: cast_availability niet aanroepbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: cast_availability niet aanroepbaar', true); end;
  begin perform public.get_my_vote(pg_temp.ev()); perform pg_temp.t('anon: get_my_vote niet aanroepbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: get_my_vote niet aanroepbaar', true); end;
  begin perform public.admin_list_participants(pg_temp.ev()); perform pg_temp.t('anon: admin-overzicht niet aanroepbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: admin-overzicht niet aanroepbaar', true); end;
  begin perform public.hit_rate_limit('x', 1, 60); perform pg_temp.t('anon: hit_rate_limit niet aanroepbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: hit_rate_limit niet aanroepbaar', true); end;
  begin perform public.purge_vote_details(0); perform pg_temp.t('anon: purge niet aanroepbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: purge niet aanroepbaar', true); end;
  perform pg_temp.t('anon: concept-event niet publiek', public.get_public_event('tweede-etentje') is null);
  perform pg_temp.t('anon: bezoeken publiek leesbaar', jsonb_array_length(public.get_public_visits()) >= 1);
  perform pg_temp.t('anon: datums verborgen zolang op slot',
    jsonb_array_length(public.get_public_event('rls-test') -> 'dateOptions') = 0);
end $$;
reset role;

-- ── Fase 1 (restaurant): gebruiker A ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
do $$
declare n int; j jsonb;
begin
  perform public.cast_venue_vote(pg_temp.ev(), 'Anna', current_setting('t.heinde')::uuid, false);
  perform public.cast_venue_vote(pg_temp.ev(), 'Anna B', null, true);
  j := public.get_public_tally(pg_temp.ev());
  perform pg_temp.t('A: restaurant wijzigen telt niet dubbel', (j ->> 'participantCount')::int = 1
    and (j -> 'venues' ->> 'none')::int = 1 and (j -> 'venues' ->> current_setting('t.heinde'))::int = 0);
  perform pg_temp.t('A: tally bevat geen namen/e-mail', j::text not like '%Anna%' and j::text not like '%@%');
  perform pg_temp.t('A: ziet eigen stem', public.get_my_vote(pg_temp.ev()) -> 'vote' ->> 'displayName' = 'Anna B');
  begin perform public.cast_availability(pg_temp.ev(), 'Anna', jsonb_build_object(pg_temp.d1(), 'yes'));
        perform pg_temp.t('A: datum prikken op slot in fase 1', false);
  exception when raise_exception then perform pg_temp.t('A: datum prikken op slot in fase 1', sqlerrm = 'dates_locked'); end;
  begin perform public.cast_venue_vote(pg_temp.ev(), 'x', current_setting('t.ixi')::uuid, false);
        perform pg_temp.t('A: restaurant buiten poll geweigerd', false);
  exception when raise_exception then perform pg_temp.t('A: restaurant buiten poll geweigerd', sqlerrm = 'invalid_venue'); end;
  begin perform public.cast_venue_vote(pg_temp.ev(), 'x', null, true, '{"name":"Plek","url":"javascript:alert(1)"}'::jsonb);
        perform pg_temp.t('A: javascript:-link in idee geweigerd', false);
  exception when raise_exception then perform pg_temp.t('A: javascript:-link in idee geweigerd', sqlerrm = 'invalid_suggestion'); end;
  select count(*) into n from public.participants;
  perform pg_temp.t('A: ruwe tabel blijft dicht (0 rijen)', n = 0);
  begin perform public.admin_list_participants(pg_temp.ev()); perform pg_temp.t('A: admin-overzicht geweigerd', false);
  exception when raise_exception then perform pg_temp.t('A: admin-overzicht geweigerd', sqlerrm = 'forbidden'); end;
  update public.events set dates_open = true where id = pg_temp.ev();
  get diagnostics n = row_count;
  perform pg_temp.t('A: kan datumprikker niet openzetten', n = 0);
  begin insert into public.events (slug, title) values ('hack', 'x'); perform pg_temp.t('A: kan geen event maken', false);
  exception when insufficient_privilege then perform pg_temp.t('A: kan geen event maken', true); end;
  begin perform public.purge_vote_details(0); perform pg_temp.t('A: purge geweigerd', false);
  exception when raise_exception then perform pg_temp.t('A: purge geweigerd', true); end;
  perform pg_temp.t('A: am_i_admin = false', not public.am_i_admin());
end $$;
reset role;

-- ── Gebruiker C (e-mail niet bevestigd) ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
do $$
begin
  begin perform public.cast_venue_vote(pg_temp.ev(), 'x', null, true);
        perform pg_temp.t('C: onbevestigd e-mailadres geweigerd', false);
  exception when raise_exception then perform pg_temp.t('C: onbevestigd e-mailadres geweigerd', sqlerrm = 'email_not_verified'); end;
end $$;
reset role;

-- ── Beheerder D legt restaurant vast en zet de datumprikker open ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
set local role authenticated;
do $$
declare n int; j jsonb;
begin
  perform pg_temp.t('D: am_i_admin = true', public.am_i_admin());
  j := public.admin_list_participants(pg_temp.ev());
  perform pg_temp.t('D: overzicht met e-mail', j -> 0 ->> 'email' = 'a@test.invalid');
  update public.events set dates_open = true, decided_venue_id = current_setting('t.heinde')::uuid
  where id = pg_temp.ev();
  get diagnostics n = row_count;
  perform pg_temp.t('D: kan datumprikker openzetten', n = 1);
end $$;
reset role;

-- ── Fase 2 (datums) ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
do $$
declare j jsonb;
begin
  perform pg_temp.t('publiek: gekozen restaurant zichtbaar',
    public.get_public_event('rls-test') -> 'decidedVenue' ->> 'name' = 'Heinde');
  perform public.cast_availability(pg_temp.ev(), 'Anna', jsonb_build_object(pg_temp.d1(), 'yes'));
  perform public.cast_availability(pg_temp.ev(), 'Anna', jsonb_build_object(pg_temp.d1(), 'maybe'));
  j := public.get_public_tally(pg_temp.ev());
  perform pg_temp.t('A: datum wijzigen telt niet dubbel', (j -> 'dates' -> pg_temp.d1() ->> 'maybe')::int = 1
    and (j -> 'dates' -> pg_temp.d1() ->> 'yes')::int = 0 and (j ->> 'participantCount')::int = 1);
  begin perform public.cast_venue_vote(pg_temp.ev(), 'Anna', current_setting('t.heinde')::uuid, false);
        perform pg_temp.t('A: restaurantstem dicht in fase 2', false);
  exception when raise_exception then perform pg_temp.t('A: restaurantstem dicht in fase 2', sqlerrm = 'venue_phase_closed'); end;
  begin perform public.cast_availability(pg_temp.ev(), 'x', jsonb_build_object(gen_random_uuid()::text, 'yes'));
        perform pg_temp.t('A: onbekende datum geweigerd', false);
  exception when raise_exception then perform pg_temp.t('A: onbekende datum geweigerd', sqlerrm = 'invalid_option'); end;
end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
do $$
begin
  perform pg_temp.t('B: ziet stem van A niet', public.get_my_vote(pg_temp.ev()) -> 'vote' = 'null'::jsonb);
end $$;
reset role;

-- ── Noodstop en gesloten poll ──
update public.app_settings set value = 'false' where key = 'submissions_enabled';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
do $$
begin
  begin perform public.cast_availability(pg_temp.ev(), 'x', jsonb_build_object(pg_temp.d1(), 'no'));
        perform pg_temp.t('noodstop: inzending geweigerd', false);
  exception when raise_exception then perform pg_temp.t('noodstop: inzending geweigerd', sqlerrm = 'submissions_disabled'); end;
end $$;
reset role;
update public.app_settings set value = 'true' where key = 'submissions_enabled';
update public.events set status = 'closed' where slug = 'rls-test';
set local role authenticated;
do $$
begin
  begin perform public.cast_availability(pg_temp.ev(), 'x', jsonb_build_object(pg_temp.d1(), 'no'));
        perform pg_temp.t('gesloten poll: wijzigen geweigerd', false);
  exception when raise_exception then perform pg_temp.t('gesloten poll: wijzigen geweigerd', sqlerrm = 'poll_closed'); end;
end $$;
reset role;

-- Anon mag uitsluitend deze publieke lees-RPC's uitvoeren (vangt vergeten grants bij nieuwe functies).
select pg_temp.t('anon: alleen de publieke lees-RPC''s', (
  select coalesce(array_agg(p.proname::text order by p.proname), '{}') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute'))
  = array['get_active_event','get_discover_meta','get_discover_places','get_public_event',
          'get_public_settings','get_public_suggestions','get_public_tally','get_public_visits',
          'get_upcoming_venues','get_vote_tallies']);

select split_part(r, '|', 1) as test, split_part(r, '|', 2)::boolean as ok
from unnest(string_to_array(trim(trailing ';' from current_setting('t.results')), ';')) as r;

rollback;

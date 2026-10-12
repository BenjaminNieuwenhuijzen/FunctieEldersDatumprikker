-- Tests voor stemmen op suggesties (één stem per persoon per doel). Rolt alles terug.
-- Uitvoeren in de Supabase SQL editor; elke rij moet ok = true zijn.
begin;
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'v1@test.invalid', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'v2@test.invalid', now(), now(), now());
insert into public.venue_suggestions (suggested_name, status) values ('Goedgekeurd test', 'approved'), ('Pending test', 'pending');
insert into public.discover_places (osm_ref, name, lat, lon, area) values ('node/999999999999', 'Testplek', 52.09, 5.11, 'utrecht');
create function pg_temp.t(name text, ok boolean) returns void language sql as $$
  select set_config('t.results', current_setting('t.results', true) || format('%s|%s;', name, ok), true) $$;
grant execute on function pg_temp.t(text, boolean) to public;
select set_config('t.results', '', true);
select set_config('t.s', (select id::text from public.venue_suggestions where suggested_name = 'Goedgekeurd test'), true);
select set_config('t.p', (select id::text from public.venue_suggestions where suggested_name = 'Pending test'), true);
select set_config('t.place', 'node/999999999999', true);

set local role anon;
do $$ begin
  begin perform public.vote_suggestion('suggestion', current_setting('t.s'), 1); perform pg_temp.t('anon: kan niet stemmen', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: kan niet stemmen', true); end;
  begin perform 1 from public.suggestion_votes; perform pg_temp.t('anon: stemmen niet leesbaar', false);
  exception when insufficient_privilege then perform pg_temp.t('anon: stemmen niet leesbaar', true); end;
  perform pg_temp.t('anon: pending niet publiek', public.get_public_suggestions()::text not like '%Pending test%');
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$ declare j jsonb; begin
  perform public.vote_suggestion('suggestion', current_setting('t.s'), 1);
  j := public.vote_suggestion('suggestion', current_setting('t.s'), 1);
  perform pg_temp.t('A: twee keer stemmen = één stem', (j->>'up')::int = 1);
  j := public.vote_suggestion('suggestion', current_setting('t.s'), -1);
  perform pg_temp.t('A: omzetten vervangt stem', (j->>'up')::int = 0 and (j->>'down')::int = 1);
  j := public.vote_suggestion('place', current_setting('t.place'), 1);
  perform pg_temp.t('A: stemmen op automatische plek', (j->>'up')::int = 1);
  begin perform public.vote_suggestion('suggestion', current_setting('t.p'), 1); perform pg_temp.t('A: niet op pending suggestie', false);
  exception when raise_exception then perform pg_temp.t('A: niet op pending suggestie', sqlerrm = 'not_found'); end;
  begin perform public.vote_suggestion('place', 'node/1', 1); perform pg_temp.t('A: niet op onbekende plek', false);
  exception when raise_exception then perform pg_temp.t('A: niet op onbekende plek', sqlerrm = 'not_found'); end;
  perform pg_temp.t('A: ziet eigen stemmen', (public.get_my_votes() ->> ('suggestion:' || current_setting('t.s')))::int = -1);
  perform pg_temp.t('tally zonder user-ids', public.get_vote_tallies()::text not like '%00000000%');
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$ declare j jsonb; begin
  perform pg_temp.t('B: ziet stemmen van A niet als eigen', public.get_my_votes() = '{}'::jsonb);
  j := public.vote_suggestion('suggestion', current_setting('t.s'), 1);
  perform pg_temp.t('B: tweede persoon telt apart', (j->>'up')::int = 1 and (j->>'down')::int = 1);
  j := public.vote_suggestion('suggestion', current_setting('t.s'), 0);
  perform pg_temp.t('B: stem intrekken', (j->>'up')::int = 0);
  perform pg_temp.t('B: ruwe stemmen niet zichtbaar', (select count(*) from public.suggestion_votes) = 0);
end $$;
reset role;

select split_part(r, '|', 1) as test, split_part(r, '|', 2)::boolean as ok
from unnest(string_to_array(trim(trailing ';' from current_setting('t.results')), ';')) as r;
rollback;

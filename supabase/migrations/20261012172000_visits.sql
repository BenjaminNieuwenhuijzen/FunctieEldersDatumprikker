-- Bevestigde bezoeken (historie). Los van polluitslagen: alleen invoeren na bevestiging door de beheerder.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  venue_id uuid not null references public.venues (id) on delete restrict,
  visited_on date not null,
  notes text check (char_length(notes) <= 1000),
  photo_path text check (char_length(photo_path) <= 300),
  -- Groepswaardering op geaggregeerd niveau (bijv. 4.5), geen individuele cijfers.
  rating_summary numeric(2, 1) check (rating_summary between 1 and 5),
  created_at timestamptz not null default now()
);
create index on public.visits (venue_id);
create index on public.visits (event_id);
create index on public.visits (visited_on desc);

alter table public.visits enable row level security;
revoke all on public.visits from anon;
create policy admin_all on public.visits for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.get_public_visits() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', x.id, 'visitedOn', x.visited_on, 'notes', x.notes, 'ratingSummary', x.rating_summary,
    'venue', public._venue_json(v))) order by x.visited_on desc), '[]'::jsonb)
  from public.visits x join public.venues v on v.id = x.venue_id
$$;
grant execute on function public.get_public_visits() to anon, authenticated;

-- Bevestigd door de beheerder: eerste etentje, Daebak Utrecht, 27 maart 2026.
insert into public.visits (venue_id, visited_on, notes)
select id, date '2026-03-27', 'Het eerste etentje van Functie Elders.'
from public.venues where slug = 'daebak-utrecht';

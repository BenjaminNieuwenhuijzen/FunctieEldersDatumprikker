-- Gevonden door de beveiligingstest: nieuwe functies krijgen in Postgres standaard EXECUTE voor
-- PUBLIC (en dus anon). "alter default privileges ... in schema public" heft die globale default
-- niet op. Herstel de rechten en zet de globale default voor toekomstige functies goed.
revoke execute on function public.cast_vote(uuid, text, jsonb, uuid, boolean, jsonb),
  public.get_my_vote(uuid), public.admin_list_participants(uuid)
  from public, anon;
grant execute on function public.cast_vote(uuid, text, jsonb, uuid, boolean, jsonb),
  public.get_my_vote(uuid), public.admin_list_participants(uuid)
  to authenticated;

alter default privileges revoke execute on functions from public;

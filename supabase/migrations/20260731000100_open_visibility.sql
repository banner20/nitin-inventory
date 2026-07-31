-- ============================================================================
-- Everyone can see everything that's checked out, not just their own.
--
-- Previously crew could only read their own txns (RLS: person_id = auth.uid()
-- or created_by = auth.uid()), so the app could only ever show someone their
-- own open items. That was never asked for and doesn't fit a small team that
-- wants shared visibility into who has what. Reads open up to everyone;
-- writes stay exactly as restrictive as before (crew can still only sign
-- things out to themselves — nothing changes about who can act, only who can
-- see).
-- ============================================================================

drop policy txns_select on txns;
create policy txns_select on txns
  for select to authenticated using (true);

-- v_open_balances gains person_name so a shared view can say whose item it
-- is, not just show a bare person_id.
drop view if exists v_person_liability;
drop view v_open_balances;

create view v_open_balances
with (security_invoker = on) as
select
  b.*,
  i.name    as item_name,
  i.unit,
  i.kind,
  i.pack_size,
  i.pack_label,
  (select jsonb_agg(jsonb_build_object('id',p.id,'pack_size',p.pack_size,'pack_label',p.pack_label,'sku',p.sku) order by p.sort, p.pack_size)
   from item_packs p where p.item_id = i.id) as alt_packs,
  e.name    as event_name,
  e.ends_at,
  e.created_at as event_created_at,
  (now() > e.ends_at) as overdue,
  pr.full_name as person_name
from v_event_balances b
join events e on e.id = b.event_id
join items i on i.id = b.item_id
join profiles pr on pr.id = b.person_id
where b.outstanding > 0;

create view v_person_liability
with (security_invoker = on) as
select
  person_id,
  count(distinct event_id)::integer as open_events,
  sum(outstanding)::numeric(12,3)   as items_outstanding,
  count(*) filter (where overdue)::integer as overdue_lines
from v_open_balances
group by person_id;

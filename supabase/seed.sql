-- ============================================================================
-- Demo data for local development.
--
-- Every login below uses PIN 123456. This file is for `supabase db reset` on a
-- local machine only — never run it against production.
--
-- The history is deliberately not tidy: one event closes clean, one closes
-- short with a damaged unit, and one is still open and overdue. That gives the
-- dashboards, the conflict queue and the co-occurrence suggestions something
-- real to chew on the moment you start the app.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Seed helpers (dropped at the bottom)
-- ---------------------------------------------------------------------------
create or replace function seed_user(
  p_code text, p_name text, p_role user_role, p_pin text, p_phone text default null
)
returns uuid
language plpgsql
as $$
declare
  uid uuid := gen_random_uuid();
  mail text := lower(p_code) || '@nitin.local';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    mail, extensions.crypt(p_pin, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid,
    jsonb_build_object('sub', uid::text, 'email', mail),
    'email', uid::text, now(), now(), now()
  );

  insert into profiles (id, emp_code, full_name, role, phone)
  values (uid, upper(p_code), p_name, p_role, p_phone);

  return uid;
end;
$$;

create or replace function seed_txn(
  p_type txn_type, p_event uuid, p_person uuid, p_by uuid, p_when timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
as $$
declare
  tid uuid := gen_random_uuid();
begin
  insert into txns (id, client_uuid, type, event_id, person_id, created_by,
                    status, source, note, occurred_at, created_at)
  values (tid, gen_random_uuid(), p_type, p_event, p_person, p_by,
          'posted', 'manual', p_note, p_when, p_when);
  return tid;
end;
$$;

create or replace function seed_line(
  p_txn uuid, p_item text, p_qty integer,
  p_condition line_condition default null,
  p_cost numeric default null, p_vendor text default null
)
returns void
language plpgsql
as $$
declare
  iid uuid;
begin
  select id into iid from items where lower(name) = lower(p_item);
  if iid is null then
    raise exception 'seed_line: no such item %', p_item;
  end if;
  insert into txn_lines (txn_id, item_id, qty, condition, unit_cost, vendor)
  values (p_txn, iid, p_qty, p_condition, p_cost, p_vendor);
end;
$$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
select seed_user('nitin',  'Nitin Kulkarni', 'admin',   '1234', '+91 98200 11111');
select seed_user('ravi',   'Ravi Deshpande', 'manager', '123456', '+91 98200 22222');
select seed_user('amit',   'Amit Sharma',    'crew',    '1234', '+91 98200 33333');
select seed_user('priya',  'Priya Nair',     'crew',    '1234', '+91 98200 44444');
select seed_user('suresh', 'Suresh Patil',   'crew',    '1234', '+91 98200 55555');
select seed_user('farhan', 'Farhan Qureshi', 'crew',    '1234', '+91 98200 66666');

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into categories (name, sort) values
  ('Audio', 10), ('Lighting', 20), ('Rigging', 30),
  ('Cables & Power', 40), ('Consumables', 50);

-- ---------------------------------------------------------------------------
-- Master sheet. Aliases matter more than they look: they are what makes
-- "par can" find "LED PAR 64" without anyone scanning anything.
-- ---------------------------------------------------------------------------
insert into items (name, category_id, unit, sku, min_stock, aliases) values
  ('Line Array Top',            (select id from categories where name='Audio'), 'pcs', 'AUD-LA-01', 2,  '{"line array","array top","top box"}'),
  ('Subwoofer 18"',             (select id from categories where name='Audio'), 'pcs', 'AUD-SUB-18', 2, '{"sub","subs","bass bin"}'),
  ('Powered Speaker 12"',       (select id from categories where name='Audio'), 'pcs', 'AUD-PS-12', 2,  '{"top","powered top","12 inch"}'),
  ('Monitor Wedge',             (select id from categories where name='Audio'), 'pcs', 'AUD-MON-01', 2, '{"wedge","floor monitor","monitor"}'),
  ('Mixer 12ch',                (select id from categories where name='Audio'), 'pcs', 'AUD-MX-12', 1,  '{"12 channel","small mixer","console"}'),
  ('Mixer 32ch Digital',        (select id from categories where name='Audio'), 'pcs', 'AUD-MX-32', 1,  '{"32ch","digital console","x32"}'),
  ('Wireless Handheld Mic',     (select id from categories where name='Audio'), 'pcs', 'AUD-MIC-WH', 4, '{"cordless mic","handheld","wireless mic"}'),
  ('Wireless Lapel Mic',        (select id from categories where name='Audio'), 'pcs', 'AUD-MIC-WL', 2, '{"collar mic","lapel","lav","lavalier"}'),
  ('Wired Mic SM58',            (select id from categories where name='Audio'), 'pcs', 'AUD-MIC-58', 4, '{"sm58","wired mic","58"}'),
  ('DI Box',                    (select id from categories where name='Audio'), 'pcs', 'AUD-DI-01', 2,  '{"direct box","di"}'),
  ('Power Amplifier',           (select id from categories where name='Audio'), 'pcs', 'AUD-AMP-01', 1, '{"amp","amplifier"}'),
  ('Speaker Stand',             (select id from categories where name='Audio'), 'pcs', 'AUD-STD-SP', 4, '{"tripod stand","speaker pole"}'),
  ('Mic Stand Tall',            (select id from categories where name='Audio'), 'pcs', 'AUD-STD-MT', 4, '{"boom stand","tall stand"}'),
  ('Mic Stand Short',           (select id from categories where name='Audio'), 'pcs', 'AUD-STD-MS', 2, '{"short stand","desk stand"}'),

  ('LED PAR 64',                (select id from categories where name='Lighting'), 'pcs', 'LGT-PAR-64', 8, '{"par can","par","par64","led par"}'),
  ('Moving Head Spot',          (select id from categories where name='Lighting'), 'pcs', 'LGT-MH-SP', 4,  '{"moving head","spot","sharpy"}'),
  ('Moving Head Wash',          (select id from categories where name='Lighting'), 'pcs', 'LGT-MH-WA', 4,  '{"wash light","wash"}'),
  ('Blinder 4-Lite',            (select id from categories where name='Lighting'), 'pcs', 'LGT-BLD-4', 2,  '{"blinder","4 lite","audience blinder"}'),
  ('Follow Spot',               (select id from categories where name='Lighting'), 'pcs', 'LGT-FS-01', 1,  '{"followspot","spot light"}'),
  ('Hazer',                     (select id from categories where name='Lighting'), 'pcs', 'LGT-HZ-01', 1,  '{"haze machine","haze"}'),
  ('Fog Machine',               (select id from categories where name='Lighting'), 'pcs', 'LGT-FOG-01', 1, '{"smoke machine","fogger","smoke"}'),
  ('DMX Controller',            (select id from categories where name='Lighting'), 'pcs', 'LGT-DMX-CT', 1, '{"light desk","dmx desk","controller"}'),
  ('LED Strip 1m',              (select id from categories where name='Lighting'), 'pcs', 'LGT-STR-1M', 10, '{"led strip","strip light","batten"}'),

  ('Truss 10ft',                (select id from categories where name='Rigging'), 'pcs', 'RIG-TRS-10', 6, '{"truss","10 feet truss","box truss"}'),
  ('Truss Corner',              (select id from categories where name='Rigging'), 'pcs', 'RIG-TRS-CN', 4, '{"corner block","truss corner"}'),
  ('Truss Base Plate',          (select id from categories where name='Rigging'), 'pcs', 'RIG-TRS-BP', 4, '{"base plate","truss base"}'),
  ('Chain Hoist 1T',            (select id from categories where name='Rigging'), 'pcs', 'RIG-CH-1T', 2,  '{"chain block","hoist","1 ton"}'),
  ('Ratchet Strap',             (select id from categories where name='Rigging'), 'pcs', 'RIG-STP-01', 6, '{"strap","tie down","ratchet"}'),
  ('Sandbag 20kg',              (select id from categories where name='Rigging'), 'pcs', 'RIG-SB-20', 8,  '{"sand bag","weight","ballast"}'),
  ('Barricade Section',         (select id from categories where name='Rigging'), 'pcs', 'RIG-BAR-01', 4, '{"barricade","crowd barrier","barrier"}'),

  ('XLR Cable 10m',             (select id from categories where name='Cables & Power'), 'pcs', 'CBL-XLR-10', 10, '{"xlr","mic cable","xlr 10"}'),
  ('XLR Cable 20m',             (select id from categories where name='Cables & Power'), 'pcs', 'CBL-XLR-20', 6,  '{"long xlr","xlr 20"}'),
  ('Speakon Cable 15m',         (select id from categories where name='Cables & Power'), 'pcs', 'CBL-SPK-15', 8,  '{"speakon","speaker cable"}'),
  ('DMX Cable 5m',              (select id from categories where name='Cables & Power'), 'pcs', 'CBL-DMX-05', 10, '{"dmx","dmx cable","signal cable"}'),
  ('Power Extension 15m',       (select id from categories where name='Cables & Power'), 'pcs', 'CBL-PWR-15', 8,  '{"extension","extension board","power cable"}'),
  ('Distro Box 63A',            (select id from categories where name='Cables & Power'), 'pcs', 'CBL-DST-63', 1,  '{"distro","power distro","63 amp"}'),
  ('IEC Cable',                 (select id from categories where name='Cables & Power'), 'pcs', 'CBL-IEC-01', 20, '{"kettle lead","iec","power lead"}'),

  ('Gaffer Tape Black',         (select id from categories where name='Consumables'), 'roll', 'CON-GAF-BK', 6, '{"gaff","gaffer","tape"}'),
  ('Cable Tie 300mm',           (select id from categories where name='Consumables'), 'pkt', 'CON-CT-300', 5,  '{"zip tie","cable tie","tie"}'),
  ('Batteries AA',              (select id from categories where name='Consumables'), 'pkt', 'CON-BAT-AA', 10, '{"aa","pencil cell","batteries"}'),
  ('Batteries 9V',              (select id from categories where name='Consumables'), 'pkt', 'CON-BAT-9V', 5,  '{"9 volt","9v"}'),
  ('Cable Protector',           (select id from categories where name='Consumables'), 'pcs', 'CON-CP-01', 4,   '{"cable ramp","yellow jacket","protector"}');

-- ---------------------------------------------------------------------------
-- Kits — one tap instead of eighteen
-- ---------------------------------------------------------------------------
insert into kits (name, description) values
  ('Wedding Audio Package A', 'Standard sangeet / reception PA for up to 300 guests'),
  ('Basic Lighting Rig',      'Truss, pars and a couple of moving heads'),
  ('Conference AV',           'Podium sound and presentation audio');

insert into kit_lines (kit_id, item_id, qty)
select (select id from kits where name='Wedding Audio Package A'), id, q.qty
from (values
  ('Line Array Top', 4), ('Subwoofer 18"', 4), ('Mixer 32ch Digital', 1),
  ('Wireless Handheld Mic', 4), ('Wireless Lapel Mic', 2), ('Monitor Wedge', 2),
  ('Speakon Cable 15m', 8), ('XLR Cable 10m', 8), ('Power Extension 15m', 4),
  ('Distro Box 63A', 1), ('Gaffer Tape Black', 2)
) as q(name, qty)
join items on lower(items.name) = lower(q.name);

insert into kit_lines (kit_id, item_id, qty)
select (select id from kits where name='Basic Lighting Rig'), id, q.qty
from (values
  ('Truss 10ft', 4), ('Truss Corner', 4), ('Truss Base Plate', 4),
  ('LED PAR 64', 12), ('Moving Head Wash', 4), ('DMX Controller', 1),
  ('DMX Cable 5m', 8), ('Hazer', 1), ('Sandbag 20kg', 4)
) as q(name, qty)
join items on lower(items.name) = lower(q.name);

insert into kit_lines (kit_id, item_id, qty)
select (select id from kits where name='Conference AV'), id, q.qty
from (values
  ('Powered Speaker 12"', 2), ('Mixer 12ch', 1), ('Wireless Handheld Mic', 2),
  ('Wireless Lapel Mic', 2), ('Mic Stand Tall', 2), ('DI Box', 2),
  ('XLR Cable 10m', 6), ('Speaker Stand', 2), ('IEC Cable', 4)
) as q(name, qty)
join items on lower(items.name) = lower(q.name);

-- ---------------------------------------------------------------------------
-- Opening stock (ADD) — this is what the company owns
-- ---------------------------------------------------------------------------
do $$
declare
  admin_id uuid := (select id from profiles where emp_code = 'NITIN');
  t uuid;
begin
  t := seed_txn('ADD', null, null, admin_id, now() - interval '18 months', 'Opening stock');

  perform seed_line(t, 'Line Array Top',        8, null, 78000, 'Sound Sales India');
  perform seed_line(t, 'Subwoofer 18"',         8, null, 92000, 'Sound Sales India');
  perform seed_line(t, 'Powered Speaker 12"',   6, null, 41000, 'Sound Sales India');
  perform seed_line(t, 'Monitor Wedge',         6, null, 28000, 'Sound Sales India');
  perform seed_line(t, 'Mixer 12ch',            2, null, 34000, 'AV Bazaar');
  perform seed_line(t, 'Mixer 32ch Digital',    2, null, 210000, 'AV Bazaar');
  perform seed_line(t, 'Wireless Handheld Mic', 12, null, 15500, 'AV Bazaar');
  perform seed_line(t, 'Wireless Lapel Mic',    8, null, 16500, 'AV Bazaar');
  perform seed_line(t, 'Wired Mic SM58',        10, null, 8900, 'AV Bazaar');
  perform seed_line(t, 'DI Box',                6, null, 4200, 'AV Bazaar');
  perform seed_line(t, 'Power Amplifier',       4, null, 56000, 'Sound Sales India');
  perform seed_line(t, 'Speaker Stand',         10, null, 3800, 'Stage Supplies Co');
  perform seed_line(t, 'Mic Stand Tall',        12, null, 2400, 'Stage Supplies Co');
  perform seed_line(t, 'Mic Stand Short',       6, null, 1900, 'Stage Supplies Co');

  perform seed_line(t, 'LED PAR 64',            36, null, 4300, 'Lightcraft');
  perform seed_line(t, 'Moving Head Spot',      8, null, 68000, 'Lightcraft');
  perform seed_line(t, 'Moving Head Wash',      8, null, 61000, 'Lightcraft');
  perform seed_line(t, 'Blinder 4-Lite',        4, null, 12500, 'Lightcraft');
  perform seed_line(t, 'Follow Spot',           2, null, 47000, 'Lightcraft');
  perform seed_line(t, 'Hazer',                 3, null, 22000, 'Lightcraft');
  perform seed_line(t, 'Fog Machine',           3, null, 9800, 'Lightcraft');
  perform seed_line(t, 'DMX Controller',        2, null, 38000, 'Lightcraft');
  perform seed_line(t, 'LED Strip 1m',          40, null, 2100, 'Lightcraft');

  perform seed_line(t, 'Truss 10ft',            24, null, 8600, 'Stage Supplies Co');
  perform seed_line(t, 'Truss Corner',          12, null, 5400, 'Stage Supplies Co');
  perform seed_line(t, 'Truss Base Plate',      12, null, 4100, 'Stage Supplies Co');
  perform seed_line(t, 'Chain Hoist 1T',        6, null, 31000, 'Stage Supplies Co');
  perform seed_line(t, 'Ratchet Strap',         24, null, 650, 'Stage Supplies Co');
  perform seed_line(t, 'Sandbag 20kg',          30, null, 900, 'Stage Supplies Co');
  perform seed_line(t, 'Barricade Section',     20, null, 3200, 'Stage Supplies Co');

  perform seed_line(t, 'XLR Cable 10m',         40, null, 620, 'Cable House');
  perform seed_line(t, 'XLR Cable 20m',         20, null, 1100, 'Cable House');
  perform seed_line(t, 'Speakon Cable 15m',     30, null, 1450, 'Cable House');
  perform seed_line(t, 'DMX Cable 5m',          30, null, 480, 'Cable House');
  perform seed_line(t, 'Power Extension 15m',   24, null, 1300, 'Cable House');
  perform seed_line(t, 'Distro Box 63A',        3, null, 27000, 'Cable House');
  perform seed_line(t, 'IEC Cable',             60, null, 180, 'Cable House');

  perform seed_line(t, 'Gaffer Tape Black',     24, null, 450, 'Cable House');
  perform seed_line(t, 'Cable Tie 300mm',       20, null, 220, 'Cable House');
  perform seed_line(t, 'Batteries AA',          40, null, 320, 'Cable House');
  perform seed_line(t, 'Batteries 9V',          20, null, 280, 'Cable House');
  perform seed_line(t, 'Cable Protector',       10, null, 2600, 'Stage Supplies Co');
end $$;

-- ---------------------------------------------------------------------------
-- Events + movement history
-- ---------------------------------------------------------------------------
insert into events (name, client, venue, starts_at, ends_at, status, created_by) values
  ('Sharma Sangeet', 'Sharma Family', 'Grand Hyatt Ballroom',
   now() - interval '40 days', now() - interval '39 days', 'closed',
   (select id from profiles where emp_code='RAVI')),
  ('TechCon Keynote', 'Northline Systems', 'Bombay Exhibition Centre, Hall 2',
   now() - interval '21 days', now() - interval '19 days', 'closed',
   (select id from profiles where emp_code='RAVI')),
  ('Mehta Wedding Reception', 'Mehta Family', 'Sahara Star, Andheri',
   now() - interval '6 days', now() - interval '4 days', 'out',
   (select id from profiles where emp_code='RAVI')),
  ('Aurora Product Launch', 'Aurora Devices', 'JW Marriott Juhu',
   now() + interval '9 days', now() + interval '10 days', 'planned',
   (select id from profiles where emp_code='RAVI')),
  ('Kapoor Reception', 'Kapoor Family', 'The Lalit, Andheri',
   now() + interval '9 days', now() + interval '11 days', 'planned',
   (select id from profiles where emp_code='RAVI'));

-- Event 1 — went out, came back clean. The boring, correct case.
do $$
declare
  ev uuid := (select id from events where name='Sharma Sangeet');
  amit uuid := (select id from profiles where emp_code='AMIT');
  ravi uuid := (select id from profiles where emp_code='RAVI');
  t uuid;
begin
  t := seed_txn('OUT', ev, amit, amit, now() - interval '41 days', 'Load out for sangeet');
  perform seed_line(t, 'Line Array Top', 4);
  perform seed_line(t, 'Subwoofer 18"', 4);
  perform seed_line(t, 'Mixer 32ch Digital', 1);
  perform seed_line(t, 'Wireless Handheld Mic', 4);
  perform seed_line(t, 'LED PAR 64', 12);
  perform seed_line(t, 'Moving Head Wash', 4);
  perform seed_line(t, 'Hazer', 1);
  perform seed_line(t, 'Truss 10ft', 4);
  perform seed_line(t, 'Speakon Cable 15m', 8);
  perform seed_line(t, 'XLR Cable 10m', 8);
  perform seed_line(t, 'Gaffer Tape Black', 2);

  t := seed_txn('IN', ev, amit, ravi, now() - interval '38 days', 'All returned');
  perform seed_line(t, 'Line Array Top', 4, 'ok');
  perform seed_line(t, 'Subwoofer 18"', 4, 'ok');
  perform seed_line(t, 'Mixer 32ch Digital', 1, 'ok');
  perform seed_line(t, 'Wireless Handheld Mic', 4, 'ok');
  perform seed_line(t, 'LED PAR 64', 12, 'ok');
  perform seed_line(t, 'Moving Head Wash', 4, 'ok');
  perform seed_line(t, 'Hazer', 1, 'ok');
  perform seed_line(t, 'Truss 10ft', 4, 'ok');
  perform seed_line(t, 'Speakon Cable 15m', 8, 'ok');
  perform seed_line(t, 'XLR Cable 10m', 8, 'ok');
  -- Tape is a consumable; it does not come back.
  perform seed_line(t, 'Gaffer Tape Black', 2, 'lost');
end $$;

-- Event 2 — closed short. Two mic stands never came back and a moving head
-- returned damaged. This is the case the whole app exists for.
do $$
declare
  ev uuid := (select id from events where name='TechCon Keynote');
  priya uuid := (select id from profiles where emp_code='PRIYA');
  ravi uuid := (select id from profiles where emp_code='RAVI');
  t uuid;
begin
  t := seed_txn('OUT', ev, priya, priya, now() - interval '22 days', 'Keynote hall');
  perform seed_line(t, 'Powered Speaker 12"', 4);
  perform seed_line(t, 'Mixer 12ch', 1);
  perform seed_line(t, 'Wireless Lapel Mic', 4);
  perform seed_line(t, 'Wireless Handheld Mic', 2);
  perform seed_line(t, 'Mic Stand Tall', 6);
  perform seed_line(t, 'Moving Head Spot', 4);
  perform seed_line(t, 'LED PAR 64', 8);
  perform seed_line(t, 'DMX Cable 5m', 6);
  perform seed_line(t, 'XLR Cable 10m', 10);
  perform seed_line(t, 'Power Extension 15m', 6);
  perform seed_line(t, 'Batteries AA', 4);

  t := seed_txn('IN', ev, priya, ravi, now() - interval '18 days',
                'Two stands missing, one spot came back damaged');
  perform seed_line(t, 'Powered Speaker 12"', 4, 'ok');
  perform seed_line(t, 'Mixer 12ch', 1, 'ok');
  perform seed_line(t, 'Wireless Lapel Mic', 4, 'ok');
  perform seed_line(t, 'Wireless Handheld Mic', 2, 'ok');
  perform seed_line(t, 'Mic Stand Tall', 4, 'ok');
  perform seed_line(t, 'Mic Stand Tall', 2, 'lost');
  perform seed_line(t, 'Moving Head Spot', 3, 'ok');
  perform seed_line(t, 'Moving Head Spot', 1, 'damaged');
  perform seed_line(t, 'LED PAR 64', 8, 'ok');
  perform seed_line(t, 'DMX Cable 5m', 6, 'ok');
  perform seed_line(t, 'XLR Cable 10m', 10, 'ok');
  perform seed_line(t, 'Power Extension 15m', 6, 'ok');
  perform seed_line(t, 'Batteries AA', 4, 'lost');
end $$;

-- Event 3 — still out, and past its end date. Should light up as overdue.
do $$
declare
  ev uuid := (select id from events where name='Mehta Wedding Reception');
  suresh uuid := (select id from profiles where emp_code='SURESH');
  farhan uuid := (select id from profiles where emp_code='FARHAN');
  t uuid;
begin
  t := seed_txn('OUT', ev, suresh, suresh, now() - interval '7 days', 'Audio load out');
  perform seed_line(t, 'Line Array Top', 4);
  perform seed_line(t, 'Subwoofer 18"', 4);
  perform seed_line(t, 'Mixer 32ch Digital', 1);
  perform seed_line(t, 'Wireless Handheld Mic', 4);
  perform seed_line(t, 'Wireless Lapel Mic', 2);
  perform seed_line(t, 'Monitor Wedge', 2);
  perform seed_line(t, 'Speakon Cable 15m', 8);
  perform seed_line(t, 'Distro Box 63A', 1);

  t := seed_txn('OUT', ev, farhan, farhan, now() - interval '7 days', 'Lighting load out');
  perform seed_line(t, 'LED PAR 64', 16);
  perform seed_line(t, 'Moving Head Wash', 4);
  perform seed_line(t, 'Truss 10ft', 8);
  perform seed_line(t, 'Truss Corner', 4);
  perform seed_line(t, 'Chain Hoist 1T', 2);
  perform seed_line(t, 'Sandbag 20kg', 8);
  perform seed_line(t, 'DMX Cable 5m', 10);
  perform seed_line(t, 'Hazer', 1);

  -- Suresh has returned part of his load already; Farhan has returned nothing.
  t := seed_txn('IN', ev, suresh, suresh, now() - interval '3 days', 'Partial return');
  perform seed_line(t, 'Monitor Wedge', 2, 'ok');
  perform seed_line(t, 'Wireless Lapel Mic', 2, 'ok');
  perform seed_line(t, 'Speakon Cable 15m', 8, 'ok');
end $$;

-- ---------------------------------------------------------------------------
-- A near-duplicate for the admin conflict queue to catch, plus a consumable
-- already under its minimum so the reorder list is not empty.
-- ---------------------------------------------------------------------------
insert into items (name, category_id, unit, min_stock, aliases)
values ('Led Par-64 (old stock)',
        (select id from categories where name='Lighting'), 'pcs', 0, '{"par 64 old"}');

do $$
declare
  admin_id uuid := (select id from profiles where emp_code='NITIN');
  t uuid;
begin
  t := seed_txn('ADD', null, null, admin_id, now() - interval '14 months', 'Second-hand purchase');
  perform seed_line(t, 'Led Par-64 (old stock)', 6, null, 2200, 'Lightcraft');

  -- Consumables burnt through on site.
  t := seed_txn('WRITEOFF', null, null, admin_id, now() - interval '30 days', 'Used up on site');
  perform seed_line(t, 'Cable Tie 300mm', 16);
  perform seed_line(t, 'Batteries 9V', 17);
end $$;

-- ---------------------------------------------------------------------------
drop function seed_line(uuid, text, integer, line_condition, numeric, text);
drop function seed_txn(txn_type, uuid, uuid, uuid, timestamptz, text);
drop function seed_user(text, text, user_role, text, text);

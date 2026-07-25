-- ============================================================================
-- Starter master sheet for an events company.
--
-- Safe to run on a real project: this creates the catalogue only — no user
-- accounts, no fake events, no invented stock. Every item starts at zero on
-- hand, so the first thing you do is record what you actually own through
-- Admin -> Stock in.
--
-- Re-runnable: existing items are left alone rather than duplicated.
-- ============================================================================

insert into categories (name, sort) values
  ('Audio', 10), ('Lighting', 20), ('Rigging', 30),
  ('Cables & Power', 40), ('Consumables', 50)
on conflict (name) do nothing;

-- Aliases are what make search work the way people actually talk: "par can"
-- finds "LED PAR 64", "collar mic" finds the lapel mic.
insert into items (name, category_id, unit, sku, min_stock, aliases)
select v.name, c.id, v.unit, v.sku, v.min_stock, v.aliases
from (values
  ('Line Array Top',        'Audio', 'pcs', 'AUD-LA-01',  2,  '{"line array","array top","top box"}'::text[]),
  ('Subwoofer 18"',         'Audio', 'pcs', 'AUD-SUB-18', 2,  '{"sub","subs","bass bin"}'::text[]),
  ('Powered Speaker 12"',   'Audio', 'pcs', 'AUD-PS-12',  2,  '{"top","powered top","12 inch"}'::text[]),
  ('Monitor Wedge',         'Audio', 'pcs', 'AUD-MON-01', 2,  '{"wedge","floor monitor","monitor"}'::text[]),
  ('Mixer 12ch',            'Audio', 'pcs', 'AUD-MX-12',  1,  '{"12 channel","small mixer","console"}'::text[]),
  ('Mixer 32ch Digital',    'Audio', 'pcs', 'AUD-MX-32',  1,  '{"32ch","digital console","x32"}'::text[]),
  ('Wireless Handheld Mic', 'Audio', 'pcs', 'AUD-MIC-WH', 4,  '{"cordless mic","handheld","wireless mic"}'::text[]),
  ('Wireless Lapel Mic',    'Audio', 'pcs', 'AUD-MIC-WL', 2,  '{"collar mic","lapel","lav","lavalier"}'::text[]),
  ('Wired Mic SM58',        'Audio', 'pcs', 'AUD-MIC-58', 4,  '{"sm58","wired mic","58"}'::text[]),
  ('DI Box',                'Audio', 'pcs', 'AUD-DI-01',  2,  '{"direct box","di"}'::text[]),
  ('Power Amplifier',       'Audio', 'pcs', 'AUD-AMP-01', 1,  '{"amp","amplifier"}'::text[]),
  ('Speaker Stand',         'Audio', 'pcs', 'AUD-STD-SP', 4,  '{"tripod stand","speaker pole"}'::text[]),
  ('Mic Stand Tall',        'Audio', 'pcs', 'AUD-STD-MT', 4,  '{"boom stand","tall stand"}'::text[]),
  ('Mic Stand Short',       'Audio', 'pcs', 'AUD-STD-MS', 2,  '{"short stand","desk stand"}'::text[]),

  ('LED PAR 64',            'Lighting', 'pcs', 'LGT-PAR-64', 8,  '{"par can","par","par64","led par"}'::text[]),
  ('Moving Head Spot',      'Lighting', 'pcs', 'LGT-MH-SP',  4,  '{"moving head","spot","sharpy"}'::text[]),
  ('Moving Head Wash',      'Lighting', 'pcs', 'LGT-MH-WA',  4,  '{"wash light","wash"}'::text[]),
  ('Blinder 4-Lite',        'Lighting', 'pcs', 'LGT-BLD-4',  2,  '{"blinder","4 lite","audience blinder"}'::text[]),
  ('Follow Spot',           'Lighting', 'pcs', 'LGT-FS-01',  1,  '{"followspot","spot light"}'::text[]),
  ('Hazer',                 'Lighting', 'pcs', 'LGT-HZ-01',  1,  '{"haze machine","haze"}'::text[]),
  ('Fog Machine',           'Lighting', 'pcs', 'LGT-FOG-01', 1,  '{"smoke machine","fogger","smoke"}'::text[]),
  ('DMX Controller',        'Lighting', 'pcs', 'LGT-DMX-CT', 1,  '{"light desk","dmx desk","controller"}'::text[]),
  ('LED Strip 1m',          'Lighting', 'pcs', 'LGT-STR-1M', 10, '{"led strip","strip light","batten"}'::text[]),

  ('Truss 10ft',            'Rigging', 'pcs', 'RIG-TRS-10', 6, '{"truss","10 feet truss","box truss"}'::text[]),
  ('Truss Corner',          'Rigging', 'pcs', 'RIG-TRS-CN', 4, '{"corner block","truss corner"}'::text[]),
  ('Truss Base Plate',      'Rigging', 'pcs', 'RIG-TRS-BP', 4, '{"base plate","truss base"}'::text[]),
  ('Chain Hoist 1T',        'Rigging', 'pcs', 'RIG-CH-1T',  2, '{"chain block","hoist","1 ton"}'::text[]),
  ('Ratchet Strap',         'Rigging', 'pcs', 'RIG-STP-01', 6, '{"strap","tie down","ratchet"}'::text[]),
  ('Sandbag 20kg',          'Rigging', 'pcs', 'RIG-SB-20',  8, '{"sand bag","weight","ballast"}'::text[]),
  ('Barricade Section',     'Rigging', 'pcs', 'RIG-BAR-01', 4, '{"barricade","crowd barrier","barrier"}'::text[]),

  ('XLR Cable 10m',         'Cables & Power', 'pcs', 'CBL-XLR-10', 10, '{"xlr","mic cable","xlr 10"}'::text[]),
  ('XLR Cable 20m',         'Cables & Power', 'pcs', 'CBL-XLR-20', 6,  '{"long xlr","xlr 20"}'::text[]),
  ('Speakon Cable 15m',     'Cables & Power', 'pcs', 'CBL-SPK-15', 8,  '{"speakon","speaker cable"}'::text[]),
  ('DMX Cable 5m',          'Cables & Power', 'pcs', 'CBL-DMX-05', 10, '{"dmx","dmx cable","signal cable"}'::text[]),
  ('Power Extension 15m',   'Cables & Power', 'pcs', 'CBL-PWR-15', 8,  '{"extension","extension board","power cable"}'::text[]),
  ('Distro Box 63A',        'Cables & Power', 'pcs', 'CBL-DST-63', 1,  '{"distro","power distro","63 amp"}'::text[]),
  ('IEC Cable',             'Cables & Power', 'pcs', 'CBL-IEC-01', 20, '{"kettle lead","iec","power lead"}'::text[]),

  ('Gaffer Tape Black',     'Consumables', 'roll', 'CON-GAF-BK', 6,  '{"gaff","gaffer","tape"}'::text[]),
  ('Cable Tie 300mm',       'Consumables', 'pkt',  'CON-CT-300', 5,  '{"zip tie","cable tie","tie"}'::text[]),
  ('Batteries AA',          'Consumables', 'pkt',  'CON-BAT-AA', 10, '{"aa","pencil cell","batteries"}'::text[]),
  ('Batteries 9V',          'Consumables', 'pkt',  'CON-BAT-9V', 5,  '{"9 volt","9v"}'::text[]),
  ('Cable Protector',       'Consumables', 'pcs',  'CON-CP-01',  4,  '{"cable ramp","yellow jacket","protector"}'::text[])
) as v(name, category, unit, sku, min_stock, aliases)
join categories c on c.name = v.category
where not exists (select 1 from items i where lower(i.name) = lower(v.name));

-- Kits: one tap instead of eighteen taps.
insert into kits (name, description) values
  ('Wedding Audio Package A', 'Standard sangeet / reception PA for up to 300 guests'),
  ('Basic Lighting Rig',      'Truss, pars and a couple of moving heads'),
  ('Conference AV',           'Podium sound and presentation audio')
on conflict (name) do nothing;

insert into kit_lines (kit_id, item_id, qty)
select k.id, i.id, v.qty
from (values
  ('Wedding Audio Package A', 'Line Array Top', 4),
  ('Wedding Audio Package A', 'Subwoofer 18"', 4),
  ('Wedding Audio Package A', 'Mixer 32ch Digital', 1),
  ('Wedding Audio Package A', 'Wireless Handheld Mic', 4),
  ('Wedding Audio Package A', 'Wireless Lapel Mic', 2),
  ('Wedding Audio Package A', 'Monitor Wedge', 2),
  ('Wedding Audio Package A', 'Speakon Cable 15m', 8),
  ('Wedding Audio Package A', 'XLR Cable 10m', 8),
  ('Wedding Audio Package A', 'Power Extension 15m', 4),
  ('Wedding Audio Package A', 'Distro Box 63A', 1),
  ('Wedding Audio Package A', 'Gaffer Tape Black', 2),

  ('Basic Lighting Rig', 'Truss 10ft', 4),
  ('Basic Lighting Rig', 'Truss Corner', 4),
  ('Basic Lighting Rig', 'Truss Base Plate', 4),
  ('Basic Lighting Rig', 'LED PAR 64', 12),
  ('Basic Lighting Rig', 'Moving Head Wash', 4),
  ('Basic Lighting Rig', 'DMX Controller', 1),
  ('Basic Lighting Rig', 'DMX Cable 5m', 8),
  ('Basic Lighting Rig', 'Hazer', 1),
  ('Basic Lighting Rig', 'Sandbag 20kg', 4),

  ('Conference AV', 'Powered Speaker 12"', 2),
  ('Conference AV', 'Mixer 12ch', 1),
  ('Conference AV', 'Wireless Handheld Mic', 2),
  ('Conference AV', 'Wireless Lapel Mic', 2),
  ('Conference AV', 'Mic Stand Tall', 2),
  ('Conference AV', 'DI Box', 2),
  ('Conference AV', 'XLR Cable 10m', 6),
  ('Conference AV', 'Speaker Stand', 2),
  ('Conference AV', 'IEC Cable', 4)
) as v(kit, item, qty)
join kits k on k.name = v.kit
join items i on lower(i.name) = lower(v.item)
on conflict (kit_id, item_id) do nothing;

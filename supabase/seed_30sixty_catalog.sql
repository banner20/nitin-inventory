-- Real 30 Sixty catalog, generated from "30 Sixty Store Inventory 2026.xlsx".
-- Idempotent: guarded by "where not exists" so it can be re-run safely.
-- Initial stock-in uses each item's most recent sealed/full-pack count only —
-- open/partial bottles and loose gram amounts are intentionally left at 0 and
-- corrected later through ordinary Stock In once someone measures them.

do $$
declare
  admin_id uuid := (select id from profiles where role = 'admin' limit 1);
  syrup_cat uuid := (select id from categories where name = 'Syrups & Sweeteners');
  pantry_cat uuid := (select id from categories where name = 'Pantry & Condiments');
  acid_cat uuid := (select id from categories where name = 'Acids & Mixology Chemicals');
  bitters_cat uuid := (select id from categories where name = 'Liqueurs & Bitters');
  iid uuid;
  tid uuid;
begin
  if admin_id is null then raise exception 'no admin profile found'; end if;

  -- Syrup SNO 1: Pink Grapefruit
  select id into iid from items where lower(name) = lower('Pink Grapefruit');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Pink Grapefruit', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2027-03-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 4000);
  end if;

  -- Syrup SNO 2: Watermelon
  select id into iid from items where lower(name) = lower('Watermelon');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Watermelon', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2028-09-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2000);
  end if;

  -- Syrup SNO 3: White Chocolate
  select id into iid from items where lower(name) = lower('White Chocolate');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('White Chocolate', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2028-03-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Syrup SNO 4: Agave (Monin)
  select id into iid from items where lower(name) = lower('Agave (Monin)');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Agave (Monin)', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2028-04-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Syrup SNO 5: Passion Fruit
  select id into iid from items where lower(name) = lower('Passion Fruit');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Passion Fruit', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2027-09-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Syrup SNO 6: ElderFlower
  select id into iid from items where lower(name) = lower('ElderFlower');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('ElderFlower', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2026-11-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 4000);
  end if;

  -- Syrup SNO 7: Lavender
  select id into iid from items where lower(name) = lower('Lavender');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Lavender', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2027-10-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Syrup SNO 8: Peach
  select id into iid from items where lower(name) = lower('Peach');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Peach', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2027-02-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3000);
  end if;

  -- Syrup SNO 9: Spiced Jamun
  select id into iid from items where lower(name) = lower('Spiced Jamun');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Spiced Jamun', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2026-11-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1000);
  end if;

  -- Syrup SNO 10: Triple Sec
  select id into iid from items where lower(name) = lower('Triple Sec');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Triple Sec', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2027-09-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3000);
  end if;

  -- Syrup SNO 11: Green Apple
  select id into iid from items where lower(name) = lower('Green Apple');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Green Apple', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 12: Mango
  select id into iid from items where lower(name) = lower('Mango');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Mango', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2028-09-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3500);
  end if;

  -- Syrup SNO 13: Curacao blue
  select id into iid from items where lower(name) = lower('Curacao blue');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Curacao blue', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2026-01-01')
    returning id into iid;
  end if;

  -- Syrup SNO 14: Caramel
  select id into iid from items where lower(name) = lower('Caramel');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Caramel', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2027-10-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Syrup SNO 15: Toffee Nut
  select id into iid from items where lower(name) = lower('Toffee Nut');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Toffee Nut', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2025-08-01')
    returning id into iid;
  end if;

  -- Syrup SNO 16: Basil
  select id into iid from items where lower(name) = lower('Basil');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Basil', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2027-02-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2100);
  end if;

  -- Syrup SNO 17: Raw Mango
  select id into iid from items where lower(name) = lower('Raw Mango');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Raw Mango', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2027-07-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2100);
  end if;

  -- Syrup SNO 18: Lemon Rancho
  select id into iid from items where lower(name) = lower('Lemon Rancho');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Lemon Rancho', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2025-06-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2100);
  end if;

  -- Syrup SNO 19: Vanilla
  select id into iid from items where lower(name) = lower('Vanilla');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Vanilla', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2028-06-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Syrup SNO 20: Ginger
  select id into iid from items where lower(name) = lower('Ginger');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Ginger', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2028-09-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2000);
  end if;

  -- Syrup SNO 21: Melon
  select id into iid from items where lower(name) = lower('Melon');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Melon', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 22: Yellow Banana
  select id into iid from items where lower(name) = lower('Yellow Banana');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Yellow Banana', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1000);
  end if;

  -- Syrup SNO 23: Kiwi
  select id into iid from items where lower(name) = lower('Kiwi');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Kiwi', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2026-01-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Syrup SNO 24: Red Fruits
  select id into iid from items where lower(name) = lower('Red Fruits');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Red Fruits', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 25: Brown Butter
  select id into iid from items where lower(name) = lower('Brown Butter');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Brown Butter', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2027-02-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Syrup SNO 26: Falernum
  select id into iid from items where lower(name) = lower('Falernum');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Falernum', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2026-04-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Syrup SNO 27: Cucumber
  select id into iid from items where lower(name) = lower('Cucumber');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Cucumber', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2028-01-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3000);
  end if;

  -- Syrup SNO 28: Assion Lemongrass
  select id into iid from items where lower(name) = lower('Assion Lemongrass');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Assion Lemongrass', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2026-04-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3500);
  end if;

  -- Syrup SNO 29: Hazelnut
  select id into iid from items where lower(name) = lower('Hazelnut');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Hazelnut', syrup_cat, 'ml', 'consumable', 250, 'bottle', 0, '2027-06-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 4250);
  end if;

  -- Syrup SNO 30: Hibiscus
  select id into iid from items where lower(name) = lower('Hibiscus');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Hibiscus', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 31: Cherry
  select id into iid from items where lower(name) = lower('Cherry');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Cherry', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2026-04-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2100);
  end if;

  -- Syrup SNO 32: Dark Chocolate
  select id into iid from items where lower(name) = lower('Dark Chocolate');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Dark Chocolate', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 33: Mojito Mint
  select id into iid from items where lower(name) = lower('Mojito Mint');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Mojito Mint', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 5000);
  end if;

  -- Syrup SNO 34: Yuzu Puree
  select id into iid from items where lower(name) = lower('Yuzu Puree');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Yuzu Puree', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2026-12-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1000);
  end if;

  -- Syrup SNO 35: Blue Berry
  select id into iid from items where lower(name) = lower('Blue Berry');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Blue Berry', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 36: Lychee
  select id into iid from items where lower(name) = lower('Lychee');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Lychee', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 37: Pop Corn
  select id into iid from items where lower(name) = lower('Pop Corn');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Pop Corn', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 38: Pandan
  select id into iid from items where lower(name) = lower('Pandan');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Pandan', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2027-11-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Syrup SNO 39: Urban Platter Agave
  select id into iid from items where lower(name) = lower('Urban Platter Agave');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Urban Platter Agave', syrup_cat, 'ml', 'consumable', 250, 'bottle', 0, '2027-04-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3500);
  end if;

  -- Syrup SNO 40: Peach Tea syrup
  select id into iid from items where lower(name) = lower('Peach Tea syrup');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Peach Tea syrup', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2027-08-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Syrup SNO 42: Rosted Hazelnut
  select id into iid from items where lower(name) = lower('Rosted Hazelnut');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Rosted Hazelnut', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, '2025-11-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1000);
  end if;

  -- Syrup SNO 43: Kokum Mapro
  select id into iid from items where lower(name) = lower('Kokum Mapro');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Kokum Mapro', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2026-09-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Syrup SNO 44: khus Mapro
  select id into iid from items where lower(name) = lower('khus Mapro');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('khus Mapro', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, '2025-10-01')
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Syrup SNO 45: Chai tea
  select id into iid from items where lower(name) = lower('Chai tea');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Chai tea', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 46: Pumpkin spice syrup
  select id into iid from items where lower(name) = lower('Pumpkin spice syrup');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Pumpkin spice syrup', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 47: Anise
  select id into iid from items where lower(name) = lower('Anise');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Anise', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Syrup SNO 48: Tiramisu
  select id into iid from items where lower(name) = lower('Tiramisu');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Tiramisu', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Syrup SNO 49: Marim bulla Saffron
  select id into iid from items where lower(name) = lower('Marim bulla Saffron');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Marim bulla Saffron', syrup_cat, 'ml', 'consumable', 1000, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2000);
  end if;

  -- Syrup SNO 50: Orange Blossom
  select id into iid from items where lower(name) = lower('Orange Blossom');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Orange Blossom', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3500);
  end if;

  -- Chunnilal syrup SNO 1: केसर
  select id into iid from items where lower(name) = lower('केसर');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('केसर', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2800);
  end if;

  -- Chunnilal syrup SNO 2: खस
  select id into iid from items where lower(name) = lower('खस');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('खस', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 4900);
  end if;

  -- Chunnilal syrup SNO 3: बेला
  select id into iid from items where lower(name) = lower('बेला');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('बेला', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Chunnilal syrup SNO 4: सौंफ
  select id into iid from items where lower(name) = lower('सौंफ');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('सौंफ', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Chunnilal syrup SNO 5: इलायची
  select id into iid from items where lower(name) = lower('इलायची');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('इलायची', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Chunnilal syrup SNO 6: बुरांश
  select id into iid from items where lower(name) = lower('बुरांश');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('बुरांश', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
  end if;

  -- Chunnilal syrup SNO 7: लौंग
  select id into iid from items where lower(name) = lower('लौंग');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('लौंग', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1400);
  end if;

  -- Chunnilal syrup SNO 8: रूह अफ़ज़ा
  select id into iid from items where lower(name) = lower('रूह अफ़ज़ा');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('रूह अफ़ज़ा', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Chunnilal syrup SNO 9: गुलाब (रोज़)
  select id into iid from items where lower(name) = lower('गुलाब (रोज़)');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('गुलाब (रोज़)', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2100);
  end if;

  -- Chunnilal syrup SNO 10: पान
  select id into iid from items where lower(name) = lower('पान');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('पान', syrup_cat, 'ml', 'consumable', 700, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 700);
  end if;

  -- Ingredient SNO 1: Capers
  select id into iid from items where lower(name) = lower('Capers');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Capers', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3);
  end if;

  -- Ingredient SNO 2: Tabasco red /green
  select id into iid from items where lower(name) = lower('Tabasco red /green');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Tabasco red /green', pantry_cat, 'pcs', 'consumable', 1, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 8);
  end if;

  -- Ingredient SNO 3: Pickled Onion
  select id into iid from items where lower(name) = lower('Pickled Onion');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Pickled Onion', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
  end if;

  -- Ingredient SNO 4: Spiced red paperika
  select id into iid from items where lower(name) = lower('Spiced red paperika');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Spiced red paperika', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 5: Luxardo cherries
  select id into iid from items where lower(name) = lower('Luxardo cherries');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Luxardo cherries', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 6: Leas perrins (w/s)
  select id into iid from items where lower(name) = lower('Leas perrins (w/s)');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Leas perrins (w/s)', pantry_cat, 'pcs', 'consumable', 1, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 12);
  end if;

  -- Ingredient SNO 7: Black olive
  select id into iid from items where lower(name) = lower('Black olive');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Black olive', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
  end if;

  -- Ingredient SNO 8: Maraschino cherries
  select id into iid from items where lower(name) = lower('Maraschino cherries');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Maraschino cherries', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 9: Green olive
  select id into iid from items where lower(name) = lower('Green olive');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Green olive', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 10: Calassic pesto
  select id into iid from items where lower(name) = lower('Calassic pesto');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Calassic pesto', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 5);
  end if;

  -- Ingredient SNO 11: Whole jalapeno Ceppers
  select id into iid from items where lower(name) = lower('Whole jalapeno Ceppers');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Whole jalapeno Ceppers', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
  end if;

  -- Ingredient SNO 12: Coconut water powder
  select id into iid from items where lower(name) = lower('Coconut water powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Coconut water powder', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 5);
  end if;

  -- Ingredient SNO 13: White wine vineger
  select id into iid from items where lower(name) = lower('White wine vineger');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('White wine vineger', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 14: Black sesame oil
  select id into iid from items where lower(name) = lower('Black sesame oil');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Black sesame oil', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 15: Olive pomace oil
  select id into iid from items where lower(name) = lower('Olive pomace oil');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Olive pomace oil', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 16: Soy sauce
  select id into iid from items where lower(name) = lower('Soy sauce');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Soy sauce', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 17: Mustard sauce
  select id into iid from items where lower(name) = lower('Mustard sauce');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Mustard sauce', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 18: Pectinase ezyme
  select id into iid from items where lower(name) = lower('Pectinase ezyme');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Pectinase ezyme', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
  end if;

  -- Ingredient SNO 19: Jalapeno jar kg
  select id into iid from items where lower(name) = lower('Jalapeno jar kg');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Jalapeno jar kg', pantry_cat, 'pcs', 'consumable', 1, 'tin', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 20: Bamboo shoots halves in water
  select id into iid from items where lower(name) = lower('Bamboo shoots halves in water');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Bamboo shoots halves in water', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 4);
  end if;

  -- Ingredient SNO 21: Roasted red peppers
  select id into iid from items where lower(name) = lower('Roasted red peppers');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Roasted red peppers', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 22: Veeba salsa
  select id into iid from items where lower(name) = lower('Veeba salsa');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Veeba salsa', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
  end if;

  -- Ingredient SNO 23: Wasabi
  select id into iid from items where lower(name) = lower('Wasabi');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Wasabi', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 5);
  end if;

  -- Ingredient SNO 24: Table salt
  select id into iid from items where lower(name) = lower('Table salt');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Table salt', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
  end if;

  -- Ingredient SNO 25: Sea salt
  select id into iid from items where lower(name) = lower('Sea salt');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Sea salt', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3);
  end if;

  -- Ingredient SNO 26: Sumuc powder
  select id into iid from items where lower(name) = lower('Sumuc powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Sumuc powder', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 27: Piri Piri salt
  select id into iid from items where lower(name) = lower('Piri Piri salt');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Piri Piri salt', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 28: Black pepper
  select id into iid from items where lower(name) = lower('Black pepper');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Black pepper', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 29: Cinnamon powder
  select id into iid from items where lower(name) = lower('Cinnamon powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Cinnamon powder', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 30: Nutmeg powder
  select id into iid from items where lower(name) = lower('Nutmeg powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Nutmeg powder', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 31: Cocoa powder
  select id into iid from items where lower(name) = lower('Cocoa powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Cocoa powder', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 32: Cacao nibs
  select id into iid from items where lower(name) = lower('Cacao nibs');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Cacao nibs', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 33: Coconut Milk
  select id into iid from items where lower(name) = lower('Coconut Milk');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Coconut Milk', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 4);
  end if;

  -- Ingredient SNO 34: Soya lecithin powder
  select id into iid from items where lower(name) = lower('Soya lecithin powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Soya lecithin powder', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3);
  end if;

  -- Ingredient SNO 35: Maggi Coconut Milk Powder
  select id into iid from items where lower(name) = lower('Maggi Coconut Milk Powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Maggi Coconut Milk Powder', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 36: Himalayan salt
  select id into iid from items where lower(name) = lower('Himalayan salt');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Himalayan salt', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 3);
  end if;

  -- Ingredient SNO 37: Spiced red paperika Rosted
  select id into iid from items where lower(name) = lower('Spiced red paperika Rosted');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Spiced red paperika Rosted', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 38: Salted caramel
  select id into iid from items where lower(name) = lower('Salted caramel');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Salted caramel', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 39: Gelautine sheet
  select id into iid from items where lower(name) = lower('Gelautine sheet');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Gelautine sheet', pantry_cat, 'pcs', 'consumable', 1, 'sheet', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 4);
  end if;

  -- Ingredient SNO 40: Thesa
  select id into iid from items where lower(name) = lower('Thesa');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Thesa', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 4);
  end if;

  -- Ingredient SNO 41: Fig Jam
  select id into iid from items where lower(name) = lower('Fig Jam');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Fig Jam', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 43: Bird Eye Chilli
  select id into iid from items where lower(name) = lower('Bird Eye Chilli');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Bird Eye Chilli', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 43: Basil Seed
  select id into iid from items where lower(name) = lower('Basil Seed');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Basil Seed', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 44: Strawbery Jello powder
  select id into iid from items where lower(name) = lower('Strawbery Jello powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Strawbery Jello powder', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 45: Vegan coconut oil
  select id into iid from items where lower(name) = lower('Vegan coconut oil');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Vegan coconut oil', pantry_cat, 'pcs', 'consumable', 1, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 46: Celery Salt
  select id into iid from items where lower(name) = lower('Celery Salt');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Celery Salt', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 47: Peprica Salt
  select id into iid from items where lower(name) = lower('Peprica Salt');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Peprica Salt', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 48: Cinmmon Powder
  select id into iid from items where lower(name) = lower('Cinmmon Powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Cinmmon Powder', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 2);
  end if;

  -- Ingredient SNO 49: Black Papper
  select id into iid from items where lower(name) = lower('Black Papper');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Black Papper', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 50: Cardamom Powder
  select id into iid from items where lower(name) = lower('Cardamom Powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Cardamom Powder', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 51: Chilli Paper
  select id into iid from items where lower(name) = lower('Chilli Paper');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Chilli Paper', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 52: AKA Miso
  select id into iid from items where lower(name) = lower('AKA Miso');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('AKA Miso', pantry_cat, 'pcs', 'consumable', 1, 'box', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Ingredient SNO 54: Dry Rose marry
  select id into iid from items where lower(name) = lower('Dry Rose marry');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Dry Rose marry', pantry_cat, 'pcs', 'consumable', 1, 'pcs', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 1);
  end if;

  -- Acid: Malic Acid
  select id into iid from items where lower(name) = lower('Malic Acid');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Malic Acid', acid_cat, 'g', 'consumable', 700, 'pack', 0, null)
    returning id into iid;
  end if;

  -- Acid: Tartaric Acid
  select id into iid from items where lower(name) = lower('Tartaric Acid');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Tartaric Acid', acid_cat, 'g', 'consumable', 1000, 'pack', 0, '2027-05-01')
    returning id into iid;
  end if;

  -- Acid: Ascorbic Acid
  select id into iid from items where lower(name) = lower('Ascorbic Acid');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Ascorbic Acid', acid_cat, 'g', 'consumable', 450, 'pack', 0, null)
    returning id into iid;
  end if;

  -- Acid: Calcium Lactate Powder
  select id into iid from items where lower(name) = lower('Calcium Lactate Powder');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Calcium Lactate Powder', acid_cat, 'g', 'consumable', 250, 'pack', 0, '2024-08-01')
    returning id into iid;
  end if;

  -- Acid: Lactic Acid
  select id into iid from items where lower(name) = lower('Lactic Acid');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Lactic Acid', acid_cat, 'g', 'consumable', 400, 'pack', 0, null)
    returning id into iid;
  end if;

  -- Acid: Agar Agar
  select id into iid from items where lower(name) = lower('Agar Agar');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Agar Agar', acid_cat, 'g', 'consumable', 200, 'pack', 0, null)
    returning id into iid;
  end if;

  -- Acid: Xanthan Gum
  select id into iid from items where lower(name) = lower('Xanthan Gum');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Xanthan Gum', acid_cat, 'g', 'consumable', 500, 'pack', 0, null)
    returning id into iid;
  end if;

  -- Bitters section, added in the "(1)" July update to the sheet. No ml size
  -- given for these, so counted as whole bottles.
  select id into iid from items where lower(name) = lower('Angostura Aromatic Bitters');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Angostura Aromatic Bitters', bitters_cat, 'pcs', 'consumable', 1, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet (July update)') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 23);
  end if;

  select id into iid from items where lower(name) = lower('Angostura Cocoa Bitters');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Angostura Cocoa Bitters', bitters_cat, 'pcs', 'consumable', 1, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet (July update)') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 8);
  end if;

  select id into iid from items where lower(name) = lower('Angostura Orange Bitters');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Angostura Orange Bitters', bitters_cat, 'pcs', 'consumable', 1, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet (July update)') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 9);
  end if;

  select id into iid from items where lower(name) = lower('Stillabunt');
  if iid is null then
    insert into items (name, category_id, unit, kind, pack_size, pack_label, min_stock, expiry_date)
    values ('Stillabunt', bitters_cat, 'pcs', 'consumable', 1, 'bottle', 0, null)
    returning id into iid;
    insert into txns (client_uuid, type, created_by, status, source, occurred_at, note)
    values (gen_random_uuid(), 'ADD', admin_id, 'posted', 'manual', now(), 'Initial stock-in from 30 Sixty inventory sheet (July update)') returning id into tid;
    insert into txn_lines (txn_id, item_id, qty) values (tid, iid, 5);
  end if;

end $$;

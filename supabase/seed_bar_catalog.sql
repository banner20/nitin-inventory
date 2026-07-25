-- ============================================================================
-- Starter catalogue for a bar events company.
--
-- Safe to run on a real project: catalogue only — no accounts, no fake events,
-- no invented stock. Everything starts at zero on hand, so the first real act
-- is counting what you actually own through Admin -> Stock in.
--
-- Stock is held in a base unit so half a bottle coming back is representable.
-- pack_size is what makes that bearable to type: gin is unit=ml with
-- pack_size=750 and pack_label=bottle, so crew work in bottles and the ledger
-- stays in millilitres.
--
-- min_stock is also in the base unit — 3000 ml of gin is four bottles.
-- Re-runnable: existing items are left alone rather than duplicated.
-- ============================================================================

insert into categories (name, sort) values
  ('Spirits', 10),
  ('Liqueurs & Bitters', 20),
  ('Beer & Wine', 30),
  ('Mixers', 40),
  ('Juices & Purees', 50),
  ('Syrups & Sweeteners', 60),
  ('Garnishes', 70),
  ('Ice', 80),
  ('Glassware', 90),
  ('Bar Tools', 100),
  ('Bar Equipment', 110)
on conflict (name) do nothing;

insert into items (name, category_id, kind, unit, pack_size, pack_label, sku, min_stock, aliases)
select v.name, c.id, v.kind::item_kind, v.unit, v.pack_size, v.pack_label,
       v.sku, v.min_stock, v.aliases
from (values
  -- ---- Spirits: base unit ml, one bottle is a pack -----------------------
  ('Gin - London Dry',        'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-GIN-LD', 3000, '{"gin","london dry","dry gin"}'::text[]),
  ('Gin - Premium',           'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-GIN-PR', 1500, '{"premium gin","hendricks","tanqueray"}'::text[]),
  ('Vodka - Plain',           'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-VOD-PL', 3000, '{"vodka","plain vodka","smirnoff"}'::text[]),
  ('Vodka - Premium',         'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-VOD-PR', 1500, '{"premium vodka","grey goose","absolut"}'::text[]),
  ('White Rum',               'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-RUM-WH', 2250, '{"rum","bacardi","light rum"}'::text[]),
  ('Dark Rum',                'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-RUM-DK', 1500, '{"old monk","aged rum","black rum"}'::text[]),
  ('Whisky - Blended',        'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-WHK-BL', 3000, '{"whisky","whiskey","scotch","blended"}'::text[]),
  ('Whisky - Single Malt',    'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-WHK-SM', 750,  '{"single malt","malt"}'::text[]),
  ('Bourbon',                 'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-BRB-01', 1500, '{"bourbon","jim beam","american whiskey"}'::text[]),
  ('Tequila - Blanco',        'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-TEQ-BL', 1500, '{"tequila","blanco","silver tequila"}'::text[]),
  ('Brandy',                  'Spirits', 'consumable', 'ml', 750, 'bottle', 'SPR-BRN-01', 750,  '{"brandy","cognac"}'::text[]),

  -- ---- Liqueurs & bitters -------------------------------------------------
  ('Triple Sec',              'Liqueurs & Bitters', 'consumable', 'ml', 700, 'bottle', 'LIQ-TRP-01', 1400, '{"cointreau","orange liqueur","triple sec"}'::text[]),
  ('Coffee Liqueur',          'Liqueurs & Bitters', 'consumable', 'ml', 700, 'bottle', 'LIQ-COF-01', 700,  '{"kahlua","coffee liqueur"}'::text[]),
  ('Campari',                 'Liqueurs & Bitters', 'consumable', 'ml', 750, 'bottle', 'LIQ-CAM-01', 750,  '{"campari","red bitter"}'::text[]),
  ('Aperol',                  'Liqueurs & Bitters', 'consumable', 'ml', 750, 'bottle', 'LIQ-APR-01', 750,  '{"aperol","spritz"}'::text[]),
  ('Sweet Vermouth',          'Liqueurs & Bitters', 'consumable', 'ml', 750, 'bottle', 'LIQ-VRM-SW', 750,  '{"rosso","red vermouth","sweet vermouth"}'::text[]),
  ('Dry Vermouth',            'Liqueurs & Bitters', 'consumable', 'ml', 750, 'bottle', 'LIQ-VRM-DR', 750,  '{"dry vermouth","martini dry"}'::text[]),
  ('Peach Schnapps',          'Liqueurs & Bitters', 'consumable', 'ml', 700, 'bottle', 'LIQ-PCH-01', 700,  '{"peach","schnapps"}'::text[]),
  ('Angostura Bitters',       'Liqueurs & Bitters', 'consumable', 'ml', 200, 'bottle', 'LIQ-BIT-AN', 400,  '{"angostura","aromatic bitters","bitters"}'::text[]),
  ('Orange Bitters',          'Liqueurs & Bitters', 'consumable', 'ml', 100, 'bottle', 'LIQ-BIT-OR', 200,  '{"orange bitters"}'::text[]),

  -- ---- Beer & wine --------------------------------------------------------
  ('Beer - Lager',            'Beer & Wine', 'consumable', 'ml', 330, 'bottle', 'BER-LAG-01', 19800, '{"beer","lager","kingfisher"}'::text[]),
  ('Prosecco',                'Beer & Wine', 'consumable', 'ml', 750, 'bottle', 'WIN-PRS-01', 4500,  '{"prosecco","sparkling","bubbly"}'::text[]),
  ('White Wine',              'Beer & Wine', 'consumable', 'ml', 750, 'bottle', 'WIN-WHT-01', 3000,  '{"white wine","sauvignon"}'::text[]),
  ('Red Wine',                'Beer & Wine', 'consumable', 'ml', 750, 'bottle', 'WIN-RED-01', 3000,  '{"red wine","shiraz","cabernet"}'::text[]),

  -- ---- Mixers -------------------------------------------------------------
  ('Tonic Water',             'Mixers', 'consumable', 'ml', 250, 'bottle', 'MIX-TON-01', 15000, '{"tonic","indian tonic"}'::text[]),
  ('Soda Water',              'Mixers', 'consumable', 'ml', 300, 'bottle', 'MIX-SOD-01', 15000, '{"soda","club soda","sparkling water"}'::text[]),
  ('Cola',                    'Mixers', 'consumable', 'ml', 300, 'bottle', 'MIX-COL-01', 9000,  '{"coke","cola","pepsi"}'::text[]),
  ('Ginger Ale',              'Mixers', 'consumable', 'ml', 250, 'bottle', 'MIX-GAL-01', 5000,  '{"ginger ale"}'::text[]),
  ('Ginger Beer',             'Mixers', 'consumable', 'ml', 250, 'bottle', 'MIX-GBR-01', 5000,  '{"ginger beer","moscow mule mixer"}'::text[]),

  -- ---- Juices -------------------------------------------------------------
  ('Fresh Lime Juice',        'Juices & Purees', 'consumable', 'ml', 1000, 'litre',  'JUC-LIM-01', 4000, '{"lime juice","nimbu","fresh lime"}'::text[]),
  ('Lemon Juice',             'Juices & Purees', 'consumable', 'ml', 1000, 'litre',  'JUC-LEM-01', 2000, '{"lemon juice"}'::text[]),
  ('Orange Juice',            'Juices & Purees', 'consumable', 'ml', 1000, 'litre',  'JUC-ORG-01', 3000, '{"oj","orange juice"}'::text[]),
  ('Cranberry Juice',         'Juices & Purees', 'consumable', 'ml', 1000, 'litre',  'JUC-CRN-01', 2000, '{"cranberry","cran"}'::text[]),
  ('Pineapple Juice',         'Juices & Purees', 'consumable', 'ml', 1000, 'litre',  'JUC-PIN-01', 2000, '{"pineapple juice"}'::text[]),

  -- ---- Syrups -------------------------------------------------------------
  ('Simple Syrup',            'Syrups & Sweeteners', 'consumable', 'ml', 750, 'bottle', 'SYR-SIM-01', 2250, '{"sugar syrup","simple syrup","gomme"}'::text[]),
  ('Grenadine',               'Syrups & Sweeteners', 'consumable', 'ml', 750, 'bottle', 'SYR-GRN-01', 750,  '{"grenadine","pomegranate syrup"}'::text[]),
  ('Orgeat',                  'Syrups & Sweeteners', 'consumable', 'ml', 750, 'bottle', 'SYR-ORG-01', 750,  '{"orgeat","almond syrup"}'::text[]),
  ('Honey Syrup',             'Syrups & Sweeteners', 'consumable', 'ml', 750, 'bottle', 'SYR-HNY-01', 750,  '{"honey syrup","honey"}'::text[]),

  -- ---- Garnishes ----------------------------------------------------------
  ('Limes',                   'Garnishes', 'consumable', 'pcs', 1,    null,   'GRN-LIM-01', 100, '{"lime","nimbu","limes"}'::text[]),
  ('Lemons',                  'Garnishes', 'consumable', 'pcs', 1,    null,   'GRN-LEM-01', 60,  '{"lemon","lemons"}'::text[]),
  ('Oranges',                 'Garnishes', 'consumable', 'pcs', 1,    null,   'GRN-ORG-01', 60,  '{"orange","oranges"}'::text[]),
  ('Mint',                    'Garnishes', 'consumable', 'g',   100,  'bunch','GRN-MNT-01', 500, '{"mint","pudina","mint leaves"}'::text[]),
  ('Cucumber',                'Garnishes', 'consumable', 'pcs', 1,    null,   'GRN-CUC-01', 20,  '{"cucumber","kheera"}'::text[]),
  ('Green Olives',            'Garnishes', 'consumable', 'g',   500,  'jar',  'GRN-OLV-01', 1000,'{"olives","olive"}'::text[]),
  ('Maraschino Cherries',     'Garnishes', 'consumable', 'g',   500,  'jar',  'GRN-CHR-01', 1000,'{"cherries","cherry","maraschino"}'::text[]),
  ('Dehydrated Orange Wheels','Garnishes', 'consumable', 'pcs', 50,   'pack', 'GRN-DOW-01', 100, '{"dried orange","orange wheel","dehydrated"}'::text[]),
  ('Rimming Salt',            'Garnishes', 'consumable', 'g',   500,  'pack', 'GRN-SLT-01', 500, '{"salt","rimming salt","margarita salt"}'::text[]),

  -- ---- Ice ----------------------------------------------------------------
  ('Cubed Ice',               'Ice', 'consumable', 'kg', 10, 'bag', 'ICE-CUB-01', 50, '{"ice","cubed ice","cubes"}'::text[]),
  ('Crushed Ice',             'Ice', 'consumable', 'kg', 10, 'bag', 'ICE-CRS-01', 20, '{"crushed ice","crushed"}'::text[]),

  -- ---- Glassware: returnable ---------------------------------------------
  ('Highball Glass',          'Glassware', 'returnable', 'pcs', 25, 'crate', 'GLS-HIG-01', 200, '{"highball","collins glass","tall glass"}'::text[]),
  ('Rocks Glass',             'Glassware', 'returnable', 'pcs', 25, 'crate', 'GLS-ROC-01', 200, '{"rocks","old fashioned glass","short glass"}'::text[]),
  ('Coupe Glass',             'Glassware', 'returnable', 'pcs', 25, 'crate', 'GLS-COU-01', 100, '{"coupe","cocktail glass"}'::text[]),
  ('Martini Glass',           'Glassware', 'returnable', 'pcs', 25, 'crate', 'GLS-MAR-01', 50,  '{"martini glass","v glass"}'::text[]),
  ('Wine Glass',              'Glassware', 'returnable', 'pcs', 25, 'crate', 'GLS-WIN-01', 100, '{"wine glass","stem"}'::text[]),
  ('Shot Glass',              'Glassware', 'returnable', 'pcs', 50, 'crate', 'GLS-SHT-01', 100, '{"shot glass","shooter"}'::text[]),
  ('Copper Mug',              'Glassware', 'returnable', 'pcs', 12, 'crate', 'GLS-CUP-01', 24,  '{"copper mug","moscow mule mug"}'::text[]),

  -- ---- Bar tools: returnable ---------------------------------------------
  ('Boston Shaker',           'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-SHK-01', 8,  '{"shaker","boston","cocktail shaker"}'::text[]),
  ('Hawthorne Strainer',      'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-STR-HW', 8,  '{"strainer","hawthorne"}'::text[]),
  ('Fine Mesh Strainer',      'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-STR-FN', 6,  '{"fine strainer","tea strainer","double strain"}'::text[]),
  ('Jigger',                  'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-JIG-01', 10, '{"jigger","measure","peg measure"}'::text[]),
  ('Bar Spoon',               'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-SPN-01', 8,  '{"bar spoon","stirring spoon"}'::text[]),
  ('Muddler',                 'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-MUD-01', 6,  '{"muddler"}'::text[]),
  ('Mixing Glass',            'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-MIX-01', 6,  '{"mixing glass","stirring glass"}'::text[]),
  ('Citrus Juicer',           'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-JUI-01', 4,  '{"juicer","citrus press","hand press"}'::text[]),
  ('Cutting Board',           'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-CUT-01', 4,  '{"chopping board","cutting board"}'::text[]),
  ('Bar Knife',               'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-KNF-01', 4,  '{"knife","paring knife"}'::text[]),
  ('Ice Scoop',               'Bar Tools', 'returnable', 'pcs', 1, null, 'TOL-SCP-01', 6,  '{"scoop","ice scoop"}'::text[]),
  ('Pour Spout',              'Bar Tools', 'returnable', 'pcs', 12, 'pack','TOL-PSP-01', 24,'{"speed pourer","pourer","spout"}'::text[]),

  -- ---- Equipment: returnable ---------------------------------------------
  ('Portable Bar Station',    'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-BAR-01', 2, '{"bar counter","bar station","portable bar"}'::text[]),
  ('Back Bar Shelf',          'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-BBS-01', 2, '{"back bar","shelf","display shelf"}'::text[]),
  ('Ice Bin',                 'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-ICB-01', 4, '{"ice bin","cooler","ice box"}'::text[]),
  ('Speed Rail',              'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-SPR-01', 4, '{"speed rail","well rail"}'::text[]),
  ('Garnish Tray',            'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-GTR-01', 4, '{"garnish tray","condiment tray"}'::text[]),
  ('Bar Mat',                 'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-MAT-01', 8, '{"bar mat","service mat","spill mat"}'::text[]),
  ('Blender',                 'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-BLN-01', 2, '{"blender","mixer"}'::text[]),
  ('Cocktail Smoker',         'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-SMK-01', 1, '{"smoker","smoke gun","smoking"}'::text[]),
  ('Glass Rack',              'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-GRK-01', 8, '{"glass rack","crate","glass crate"}'::text[]),
  ('Waste Bin',               'Bar Equipment', 'returnable', 'pcs', 1, null, 'EQP-WBN-01', 4, '{"bin","dustbin","trash"}'::text[])
) as v(name, category, kind, unit, pack_size, pack_label, sku, min_stock, aliases)
join categories c on c.name = v.category
where not exists (select 1 from items i where lower(i.name) = lower(v.name));

-- ============================================================================
-- Recipes. Advisory only — nothing in the stock ledger depends on these.
-- Quantities are in each item's base unit.
-- ============================================================================
insert into recipes (name, description, glass, garnish, method) values
  ('Gin & Tonic',    'The one everybody orders.',            'Highball Glass', 'Lime wedge',        'Build over ice'),
  ('Negroni',        'Equal parts, stirred, bitter.',         'Rocks Glass',    'Orange peel',       'Stir over ice'),
  ('Margarita',      'Shaken, salted rim.',                   'Coupe Glass',    'Lime wheel',        'Shake, fine strain'),
  ('Mojito',         'Muddled mint and lime, topped soda.',   'Highball Glass', 'Mint sprig',        'Muddle, build, top'),
  ('Old Fashioned',  'Sugar, bitters, whisky, ice.',          'Rocks Glass',    'Orange peel',       'Stir over ice'),
  ('Cosmopolitan',   'Vodka, triple sec, cranberry, lime.',   'Martini Glass',  'Dehydrated orange', 'Shake, fine strain'),
  ('Whisky Sour',    'Bourbon, lemon, sugar.',                'Rocks Glass',    'Cherry',            'Shake, strain over ice'),
  ('Aperol Spritz',  'Prosecco, Aperol, splash of soda.',     'Wine Glass',     'Orange slice',      'Build over ice'),
  ('Moscow Mule',    'Vodka, lime, ginger beer.',             'Copper Mug',     'Lime wedge',        'Build over ice'),
  ('Espresso Martini','Vodka, coffee liqueur, espresso.',     'Martini Glass',  'Three coffee beans','Shake hard, strain')
on conflict do nothing;

insert into recipe_lines (recipe_id, item_id, qty)
select r.id, i.id, v.qty
from (values
  ('Gin & Tonic',     'Gin - London Dry',   60),
  ('Gin & Tonic',     'Tonic Water',        150),
  ('Gin & Tonic',     'Limes',              0.125),

  ('Negroni',         'Gin - London Dry',   30),
  ('Negroni',         'Campari',            30),
  ('Negroni',         'Sweet Vermouth',     30),
  ('Negroni',         'Oranges',            0.1),

  ('Margarita',       'Tequila - Blanco',   60),
  ('Margarita',       'Triple Sec',         30),
  ('Margarita',       'Fresh Lime Juice',   30),
  ('Margarita',       'Rimming Salt',       2),

  ('Mojito',          'White Rum',          60),
  ('Mojito',          'Fresh Lime Juice',   30),
  ('Mojito',          'Simple Syrup',       20),
  ('Mojito',          'Mint',               8),
  ('Mojito',          'Soda Water',         60),

  ('Old Fashioned',   'Bourbon',            60),
  ('Old Fashioned',   'Simple Syrup',       10),
  ('Old Fashioned',   'Angostura Bitters',  1),
  ('Old Fashioned',   'Oranges',            0.1),

  ('Cosmopolitan',    'Vodka - Plain',      45),
  ('Cosmopolitan',    'Triple Sec',         15),
  ('Cosmopolitan',    'Cranberry Juice',    30),
  ('Cosmopolitan',    'Fresh Lime Juice',   15),

  ('Whisky Sour',     'Bourbon',            60),
  ('Whisky Sour',     'Lemon Juice',        30),
  ('Whisky Sour',     'Simple Syrup',       20),
  ('Whisky Sour',     'Maraschino Cherries',10),

  ('Aperol Spritz',   'Aperol',             60),
  ('Aperol Spritz',   'Prosecco',           90),
  ('Aperol Spritz',   'Soda Water',         30),
  ('Aperol Spritz',   'Oranges',            0.1),

  ('Moscow Mule',     'Vodka - Plain',      60),
  ('Moscow Mule',     'Fresh Lime Juice',   15),
  ('Moscow Mule',     'Ginger Beer',        120),
  ('Moscow Mule',     'Limes',              0.125),

  ('Espresso Martini','Vodka - Plain',      50),
  ('Espresso Martini','Coffee Liqueur',     20),
  ('Espresso Martini','Simple Syrup',       10)
) as v(recipe, item, qty)
join recipes r on r.name = v.recipe
join items i on lower(i.name) = lower(v.item)
on conflict (recipe_id, item_id) do nothing;

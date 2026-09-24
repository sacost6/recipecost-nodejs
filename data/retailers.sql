-- Seed the retailers table with common grocery, warehouse, specialty, and online retailers.
-- PostgreSQL supplies retailer_id, created_at, and updated_at automatically.
-- Re-running this script skips existing retailers with the same exact name.
-- Retailers are stored as brands/company names; store locations belong in store_locations.

BEGIN;

INSERT INTO retailers (name, website_url)
VALUES
  -- National supermarkets and grocers.
  ('Albertsons', 'https://www.albertsons.com'),
  ('Aldi', 'https://www.aldi.us'),
  ('Bashas''', 'https://www.bashas.com'),
  ('Big Y', 'https://www.bigy.com'),
  ('Brookshire''s', 'https://www.brookshires.com'),
  ('Central Market', 'https://www.centralmarket.com'),
  ('Coborn''s', 'https://www.coborns.com'),
  ('Cub Foods', 'https://www.cub.com'),
  ('Dierbergs', 'https://www.dierbergs.com'),
  ('Food Lion', 'https://www.foodlion.com'),
  ('Food 4 Less', 'https://www.food4less.com'),
  ('Fred Meyer', 'https://www.fredmeyer.com'),
  ('Giant Food', 'https://giantfood.com'),
  ('Giant Eagle', 'https://www.gianteagle.com'),
  ('H-E-B', 'https://www.heb.com'),
  ('Harris Teeter', 'https://www.harristeeter.com'),
  ('Hy-Vee', 'https://www.hy-vee.com'),
  ('Jewel-Osco', 'https://www.jewelosco.com'),
  ('King Soopers', 'https://www.kingsoopers.com'),
  ('Kroger', 'https://www.kroger.com'),
  ('Lucky', 'https://www.luckysupermarkets.com'),
  ('Market Basket', 'https://www.shopmarketbasket.com'),
  ('Mariano''s', 'https://www.marianos.com'),
  ('Meijer', 'https://www.meijer.com'),
  ('Pavilions', 'https://www.pavilions.com'),
  ('Piggly Wiggly', 'https://www.pigglywiggly.com'),
  ('Price Chopper', 'https://www.pricechopper.com'),
  ('Publix', 'https://www.publix.com'),
  ('QFC', 'https://www.qfc.com'),
  ('Raley''s', 'https://www.raleys.com'),
  ('Randalls', 'https://www.randalls.com'),
  ('Ralphs', 'https://www.ralphs.com'),
  ('Rouses Markets', 'https://www.rouses.com'),
  ('Safeway', 'https://www.safeway.com'),
  ('Save Mart', 'https://www.savemart.com'),
  ('Shaw''s', 'https://www.shaws.com'),
  ('ShopRite', 'https://www.shoprite.com'),
  ('Smith''s', 'https://www.smithsfoodanddrug.com'),
  ('Stop & Shop', 'https://stopandshop.com'),
  ('The Fresh Market', 'https://www.thefreshmarket.com'),
  ('Tom Thumb', 'https://www.tomthumb.com'),
  ('United Supermarkets', 'https://www.unitedsupermarkets.com'),
  ('Vons', 'https://www.vons.com'),
  ('Wegmans', 'https://www.wegmans.com'),
  ('WinCo Foods', 'https://www.wincofoods.com'),
  ('Winn-Dixie', 'https://www.winndixie.com'),
  ('Walmart', 'https://www.walmart.com'),
  ('Target', 'https://www.target.com'),

  -- Warehouse clubs and bulk retailers.
  ('BJ''s Wholesale Club', 'https://www.bjs.com'),
  ('Costco', 'https://www.costco.com'),
  ('Sam''s Club', 'https://www.samsclub.com'),
  ('Restaurant Depot', 'https://www.restaurantdepot.com'),
  ('Gordon Food Service', 'https://www.gfs.com'),
  ('US Foods', 'https://www.usfoods.com'),
  ('Sysco', 'https://www.sysco.com'),
  ('WebstaurantStore', 'https://www.webstaurantstore.com'),

  -- Discount and dollar retailers with grocery departments.
  ('99 Cents Only Stores', 'https://99only.com'),
  ('Big Lots', 'https://www.biglots.com'),
  ('Dollar General', 'https://www.dollargeneral.com'),
  ('Dollar Tree', 'https://www.dollartree.com'),
  ('Family Dollar', 'https://www.familydollar.com'),
  ('Five Below', 'https://www.fivebelow.com'),
  ('Grocery Outlet', 'https://www.groceryoutlet.com'),
  ('Ollie''s Bargain Outlet', 'https://www.ollies.com'),
  ('Save A Lot', 'https://savealot.com'),

  -- Natural, organic, and specialty grocers.
  ('Amazon Fresh', 'https://www.amazon.com/fresh'),
  ('Earth Fare', 'https://www.earthfare.com'),
  ('Erewhon', 'https://www.erewhonmarket.com'),
  ('Foxtrot', 'https://www.foxtrotco.com'),
  ('Fresh Thyme Market', 'https://www.freshthyme.com'),
  ('Gristedes', 'https://www.gristedes.com'),
  ('H Mart', 'https://www.hmart.com'),
  ('Hana World Market', 'https://www.hanamarket.com'),
  ('MOM''s Organic Market', 'https://momsorganicmarket.com'),
  ('Natural Grocers', 'https://www.naturalgrocers.com'),
  ('New Seasons Market', 'https://www.newseasonsmarket.com'),
  ('Sprouts Farmers Market', 'https://www.sprouts.com'),
  ('Sunflower Farmers Market', 'https://www.sfmarkets.com'),
  ('Trader Joe''s', 'https://www.traderjoes.com'),
  ('Viva Markets', 'https://www.vivamarket.com'),
  ('Whole Foods Market', 'https://www.wholefoodsmarket.com'),
  ('World Market', 'https://www.worldmarket.com'),

  -- Pharmacy and convenience retailers that sell groceries.
  ('7-Eleven', 'https://www.7-eleven.com'),
  ('Casey''s', 'https://www.caseys.com'),
  ('CVS Pharmacy', 'https://www.cvs.com'),
  ('Duane Reade', 'https://www.walgreens.com'),
  ('Kum & Go', 'https://www.kumandgo.com'),
  ('Kwik Trip', 'https://www.kwiktrip.com'),
  ('Love''s Travel Stops', 'https://www.loves.com'),
  ('QuikTrip', 'https://www.quiktrip.com'),
  ('RaceTrac', 'https://www.racetrac.com'),
  ('Sheetz', 'https://www.sheetz.com'),
  ('Speedway', 'https://www.speedway.com'),
  ('Wawa', 'https://www.wawa.com'),
  ('Walgreens', 'https://www.walgreens.com'),

  -- International and cross-border retailers.
  ('Carrefour', 'https://www.carrefour.com'),
  ('Coles', 'https://www.coles.com.au'),
  ('Co-op Food', 'https://www.coop.co.uk'),
  ('ICA', 'https://www.ica.se'),
  ('Loblaws', 'https://www.loblaws.ca'),
  ('Marks & Spencer Food', 'https://www.marksandspencer.com'),
  ('Metro', 'https://www.metro.ca'),
  ('Morrisons', 'https://groceries.morrisons.com'),
  ('REWE', 'https://www.rewe.de'),
  ('Sainsbury''s', 'https://www.sainsburys.co.uk'),
  ('Sobeys', 'https://www.sobeys.com'),
  ('Tesco', 'https://www.tesco.com'),
  ('Waitrose', 'https://www.waitrose.com'),
  ('Woolworths', 'https://www.woolworths.com.au'),
  ('Mercadona', 'https://www.mercadona.es'),
  ('Lidl', 'https://www.lidl.com'),
  ('SPAR', 'https://www.spar-international.com')
ON CONFLICT (name) DO NOTHING;

COMMIT;

SELECT retailer_id, name, website_url
FROM retailers
ORDER BY name;

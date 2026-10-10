-- Local/dev convenience data only. This is NOT a migration — it is not
-- tracked as applied schema history, and `supabase db reset` re-runs it
-- every time against your local dev database. Do not run this against a
-- shared or production project; it exists so the catalog isn't empty
-- while building later phases. Mirrors the Phase 1 UI demo data for
-- continuity.

insert into public.categories (name, slug, display_order) values
  ('Tiffin', 'tiffin', 1),
  ('Meals', 'meals', 2),
  ('Snacks', 'snacks', 3),
  ('Bakery', 'bakery', 4),
  ('Beverages', 'beverages', 5)
on conflict (slug) do nothing;

insert into public.products (category_id, name, description, price, stock_quantity, is_available, is_featured)
select c.id, p.name, p.description, p.price, p.stock_quantity, p.is_available, p.is_featured
from (
  values
    ('tiffin', 'Idli (4 pcs)', 'Steamed rice cakes served with sambar and coconut chutney.', 60.00, 40, true, true),
    ('tiffin', 'Masala Dosa', 'Crisp rice crepe filled with spiced potato masala.', 90.00, 25, true, true),
    ('tiffin', 'Ven Pongal', 'Savoury rice and moong dal, tempered with pepper and cumin.', 70.00, 30, true, false),
    ('meals', 'Veg Meals (Full)', 'Rice, sambar, rasam, kootu, poriyal, curd and papad.', 150.00, 20, true, true),
    ('meals', 'Curd Rice', 'Comforting curd rice tempered with curry leaves and ginger.', 80.00, 18, true, false),
    ('snacks', 'Bonda (4 pcs)', 'Deep-fried spiced potato fritters, served with chutney.', 50.00, 35, true, false),
    ('snacks', 'Medu Vada (2 pcs)', 'Crisp urad dal fritters with a soft, fluffy centre.', 45.00, 0, false, false),
    ('bakery', 'Bun Butter Jam', 'Soft bakery bun, toasted and layered with butter and jam.', 55.00, 22, true, false),
    ('bakery', 'Suji Rusk (Pack)', 'Lightly sweet, twice-baked rusk, perfect with tea or coffee.', 65.00, 50, true, false),
    ('beverages', 'Filter Coffee', 'South Indian filter coffee, brewed fresh and served hot.', 30.00, 60, true, true),
    ('beverages', 'Spiced Buttermilk', 'Chilled buttermilk with curry leaves, ginger and green chilli.', 35.00, 28, true, false)
) as p(category_slug, name, description, price, stock_quantity, is_available, is_featured)
join public.categories c on c.slug = p.category_slug
where not exists (
  select 1 from public.products existing where existing.name = p.name
);

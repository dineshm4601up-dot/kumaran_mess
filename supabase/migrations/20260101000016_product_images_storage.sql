-- Product image storage.
--
-- Public bucket: product photos are non-sensitive, and public delivery
-- lets the menu render images with a plain URL, no signed-URL plumbing.
-- Writes are staff-only, enforced at the storage layer (not just the app
-- layer) via RLS on storage.objects, mirroring every other staff-only
-- table in this project. file_size_limit/allowed_mime_types are enforced
-- by Storage itself regardless of upload path, as a second layer behind
-- the Next.js route's own validation (see src/lib/validation/image.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_public_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy product_images_staff_write
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'product-images' and public.is_staff())
  with check (bucket_id = 'product-images' and public.is_staff());

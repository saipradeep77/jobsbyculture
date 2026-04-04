-- ============================================================
-- Supabase Storage Setup for Culture Cards media uploads
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Create storage bucket for card message images
insert into storage.buckets (id, name, public)
values ('card-media', 'card-media', true);

-- Allow anyone to upload images (files organized in folders)
create policy "Anyone can upload card media"
on storage.objects for insert
with check (
  bucket_id = 'card-media'
  and (storage.foldername(name))[1] != ''
  and octet_length(decode(replace(name, '/', ''), 'escape')) < 5242880
);

-- Allow public read access to all card media
create policy "Card media is publicly accessible"
on storage.objects for select
using (bucket_id = 'card-media');

-- Allow delete by anyone (can restrict to authenticated users later)
create policy "Anyone can delete card media"
on storage.objects for delete
using (bucket_id = 'card-media');

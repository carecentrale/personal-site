-- Run once in the Supabase SQL editor (or via migration).
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  message text not null
);
alter table public.contact_messages enable row level security;
-- No public read/update/delete. The server-side function uses the service role key, which bypasses RLS.

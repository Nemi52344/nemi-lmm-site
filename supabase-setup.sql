-- NEMI · Supabase setup for form submissions.
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.

-- 1) Submissions table (contact + careers in one table, split by the "form" column)
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form text not null check (form in ('contact', 'careers')),
  name text,
  email text,
  email_verified boolean not null default false,
  company text,
  topic text,
  message text,
  attachment_path text,
  meta jsonb
);

-- Lock it down: only the service-role key (used by the server) can read/write.
alter table public.submissions enable row level security;

-- 2) Private storage bucket for resumes / attachments
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Done. No public policies are created on purpose:
-- the site's serverless function uses the service-role key, which bypasses RLS,
-- and applicants' files stay private (the notification email gets a 7-day signed link).

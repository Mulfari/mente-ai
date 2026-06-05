-- Trending suggestions: per-event table for chip clicks and typed prompts.
-- One row per (user, prompt) — aggregated server-side to power /api/trending.
-- RLS is project-wide OFF, so no policies needed.

create table public.query_events (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users(id) on delete set null,
  category_id   text        not null,
  sub_option_id text,
  source        text        not null check (source in ('discover', 'typed', 'research')),
  prompt        text        not null,
  created_at    timestamptz not null default now()
);

create index query_events_category_sub_idx
  on public.query_events (category_id, sub_option_id, created_at desc);

create index query_events_user_idx
  on public.query_events (user_id, created_at desc);

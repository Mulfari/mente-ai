-- 20260607_add_city_to_query_events.sql
-- Add city column to query_events so the trending endpoint can power
-- the "Cerca de ti" section by filtering events to the user's city.
-- Nullable — anonymous and pre-onboarding events simply have NULL city.

alter table public.query_events
  add column city text;

-- Composite index for the trending "Cerca de ti" query:
--   WHERE city = $1 AND created_at >= $since ORDER BY created_at DESC
create index query_events_city_created_idx
  on public.query_events (city, created_at desc)
  where city is not null;

-- Safe, per-minute background worker. Requires the previous secret + RPC migration.
-- This URL belongs to the existing Tường học tập AI Supabase project.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'agent-review-v2-offline',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://vnxffqpszykkjueawtfr.supabase.co/functions/v1/tuongai',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Agent-Review-Tick', (select value from public.app_config where key = 'agent_review_cron_token')
    ),
    body := '{"action":"agent_review_tick"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

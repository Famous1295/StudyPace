do $cron_guard$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'cron') then
    select cron.unschedule('daily-twilio-reminders') where exists (select 1 from cron.job where jobname = 'daily-twilio-reminders');
  end if;
end $cron_guard$;

select cron.schedule(
  'daily-twilio-reminders',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://project--470a09f8-9f40-4ad3-8083-f2e9b683f2cf-dev.lovable.app/api/public/hooks/twilio-reminders',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_r6vrfv-LNgrYB6G3ZXY0Og_aZZv0LNs'),
    body := '{}'::jsonb
  );
  $$
);
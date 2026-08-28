ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS twilio_whatsapp_from text;

COMMENT ON COLUMN public.notification_settings.twilio_whatsapp_from IS 'Twilio WhatsApp sender number, e.g. whatsapp:+14155238886';
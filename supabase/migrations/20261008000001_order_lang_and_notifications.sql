-- Add language preference to orders (stored at checkout time)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'bs';

-- Notification log: one row per (order, type) — UNIQUE prevents duplicate sends
CREATE TABLE IF NOT EXISTS order_notifications (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id      bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('shipped', 'delivered')),
  recipient_email   text NOT NULL,
  lang              text NOT NULL DEFAULT 'bs',
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, notification_type)
);

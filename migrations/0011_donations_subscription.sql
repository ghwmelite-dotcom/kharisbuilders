ALTER TABLE donations ADD COLUMN subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;

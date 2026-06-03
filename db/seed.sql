-- Seed data (NOT a migration — applied manually with `wrangler d1 execute --file db/seed.sql`).
-- Placeholder values from the Stitch mockups; staff edit via the admin in a later phase.

INSERT OR REPLACE INTO site_settings (key, value) VALUES
  ('contact_email', 'hello@kharisbuilders.org'),
  ('phone', '+44 20 7946 0000'),
  ('address', '12 Cathedral Way, West End, London, SW1E 5RS'),
  ('service_times', '[{"name":"Sunday Morning","time":"09:00 AM","note":"Traditional"},{"name":"Sunday Evening","time":"05:30 PM","note":"Contemporary"},{"name":"Midweek Communion","time":"07:00 PM","note":"Wednesday"}]'),
  ('socials', '{"facebook":"","instagram":"","youtube":""}'),
  ('default_theme', 'sacred');

INSERT OR IGNORE INTO ministries (name, slug, description, leader, meeting_time, sort_order, published) VALUES
  ('Worship & Arts', 'worship-arts', 'Soulful music and creative expression that lifts the congregation in adoration.', 'Grace Adeyemi', 'Sundays', 1, 1),
  ('Kharis Kids', 'kharis-kids', 'A safe, fun, spiritually enriching environment for ages 2-11 during the 09:00 AM service.', 'Sarah Bello', 'Sundays 09:00 AM', 2, 1),
  ('Youth & Young Adults', 'youth', 'Building the next generation of leaders rooted in faith and purpose.', 'David Okafor', 'Fridays 07:00 PM', 3, 1),
  ('Community Outreach', 'outreach', 'Serving our city through compassion, generosity, and practical care.', 'Ruth Mensah', 'Monthly', 4, 1);

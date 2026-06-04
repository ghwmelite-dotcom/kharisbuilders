-- Generic starter settings + ministries (template). A church edits these in admin.
INSERT OR REPLACE INTO site_settings (key, value) VALUES
  ('contact_email', 'hello@example.com'),
  ('phone', ''),
  ('address', ''),
  ('service_times', '[{"name":"Sunday Morning","time":"09:00 AM","note":"Traditional"},{"name":"Sunday Evening","time":"05:30 PM","note":"Contemporary"},{"name":"Midweek Gathering","time":"07:00 PM","note":"Wednesday"}]'),
  ('socials', '{"facebook":"","instagram":"","youtube":""}');

INSERT OR IGNORE INTO ministries (name, slug, description, leader, meeting_time, sort_order, published) VALUES
  ('Worship & Arts', 'worship-arts', 'Soulful music and creative expression that lifts the congregation in worship.', '', 'Sundays', 1, 1),
  ('Children''s Ministry', 'childrens-ministry', 'A safe, fun, and caring environment for children during the morning service.', '', 'Sundays', 2, 1),
  ('Youth & Young Adults', 'youth', 'Building the next generation of leaders rooted in faith and purpose.', '', 'Fridays 07:00 PM', 3, 1),
  ('Community Outreach', 'outreach', 'Serving our community through compassion, generosity, and practical care.', '', 'Monthly', 4, 1);

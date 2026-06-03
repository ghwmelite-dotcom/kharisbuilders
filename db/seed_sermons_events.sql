-- Seed sermons + events (NOT a migration; applied via `wrangler d1 execute --file`).
-- Placeholder content from the mockups; staff edit via the admin in Phase 4.

INSERT OR IGNORE INTO sermons (title, slug, speaker, series, scripture_ref, video_url, video_provider, description, sermon_date, published) VALUES
  ('The Architecture of Faith: Part IV', 'architecture-of-faith-4', 'Lead Pastor', 'Architecture of Faith', 'Hebrews 11', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Building a life that lasts on an unshakeable foundation.', '2024-10-27', 1),
  ('A Place to Belong', 'a-place-to-belong', 'Lead Pastor', 'Foundations', 'Psalm 133', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Why community is the heart of the church.', '2024-10-20', 1),
  ('Grace That Builds', 'grace-that-builds', 'Guest Speaker', 'Foundations', 'Ephesians 2', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'Grace is the foundation every destiny is built on.', '2024-10-13', 1);

INSERT OR IGNORE INTO events (title, slug, category, description, start_at, location, registration_enabled, capacity, published) VALUES
  ('First Steps Luncheon', 'first-steps-luncheon', 'Community', 'For our new members to meet the leadership team and understand our vision.', '2999-11-03 12:30:00', 'The Glass Atrium', 1, 60, 1),
  ('Night of Adoration', 'night-of-adoration', 'Worship', 'An immersive acoustic worship experience designed for deep spiritual renewal.', '2999-11-08 19:00:00', 'Main Auditorium', 1, 200, 1),
  ('Builders Masterclass', 'builders-masterclass', 'Leadership', 'Developing practical leadership skills rooted in eternal biblical principles.', '2999-11-15 10:00:00', 'Chapel', 0, NULL, 1);

-- Generic home cards (template). Leaders + journey start EMPTY — a church adds its own.
INSERT OR IGNORE INTO home_cards (id, eyebrow, title, description, href, sort_order) VALUES
  (1, 'New Here?', 'Plan a Visit', 'Know what to expect and let us welcome you home.', '/visit', 1),
  (2, 'Messages', 'Watch Sermons', 'Catch up on recent messages, anytime, anywhere.', '/sermons', 2),
  (3, 'Generosity', 'Give', 'Partner with the mission and the ministries.', '/giving', 3);

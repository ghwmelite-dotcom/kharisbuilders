INSERT OR IGNORE INTO leaders (id, name, role, sort_order) VALUES
  (1, 'Dr. Samuel A. Kharis', 'Founding Pastor', 1),
  (2, 'Pastor Elena Kharis', 'Executive Pastor', 2),
  (3, 'Min. David Chen', 'Worship & Arts', 3);

INSERT OR IGNORE INTO journey (id, year, title, body, sort_order) VALUES
  (1, '2012', 'The First Cornerstone', 'Kharisbuilders began as a small gathering of twelve in a downtown studio, united by a vision for architectural spiritual growth.', 1),
  (2, '2017', 'Expanding the Walls', 'Our community grew to five hundred, leading us to our current sanctuary — a space designed to facilitate spiritual encounter and professional excellence.', 2),
  (3, '2024', 'Shaping the Future', 'Launching our digital global campus and the ''Builders Academy,'' training leaders for the next generation of societal transformation.', 3);

INSERT OR IGNORE INTO home_cards (id, eyebrow, title, description, href, sort_order) VALUES
  (1, 'New Here?', 'Plan a Visit', 'Know what to expect and let us welcome you home.', '/visit', 1),
  (2, 'Messages', 'Watch Sermons', 'Catch up on recent messages, anytime, anywhere.', '/sermons', 2),
  (3, 'Generosity', 'Give', 'Partner with the mission and the ministries.', '/giving', 3);

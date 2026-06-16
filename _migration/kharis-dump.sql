PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_site_settings.sql','2026-06-02 23:55:51');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_ministries.sql','2026-06-02 23:55:51');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_visitors.sql','2026-06-02 23:55:51');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_sermons.sql','2026-06-03 00:44:52');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_events.sql','2026-06-03 00:44:53');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'0006_event_registrations.sql','2026-06-03 00:44:53');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(7,'0007_funds.sql','2026-06-03 21:35:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(8,'0008_donations.sql','2026-06-03 21:35:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(9,'0009_plans.sql','2026-06-03 23:04:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(10,'0010_subscriptions.sql','2026-06-03 23:04:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(11,'0011_donations_subscription.sql','2026-06-03 23:04:14');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(12,'0012_sermon_transcript.sql','2026-06-04 00:03:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(13,'0013_sermon_study_guides.sql','2026-06-04 00:03:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(14,'0014_page_content.sql','2026-06-04 13:27:28');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(15,'0015_leaders.sql','2026-06-04 14:27:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(16,'0016_journey.sql','2026-06-04 14:27:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(17,'0017_home_cards.sql','2026-06-04 14:27:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(18,'0018_online_attendances.sql','2026-06-04 16:14:55');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(19,'0019_prayer_requests.sql','2026-06-04 16:14:56');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(20,'0020_prayer_pray_count.sql','2026-06-05 21:29:05');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(21,'0021_connections.sql','2026-06-05 22:01:31');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(22,'0022_groups.sql','2026-06-06 01:18:31');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(23,'0023_group_interests.sql','2026-06-06 01:18:31');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(24,'0024_volunteer_roles.sql','2026-06-06 02:10:17');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(25,'0025_volunteer_signups.sql','2026-06-06 02:10:17');
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "site_settings" ("key","value","updated_at") VALUES('contact_email','hello@kharisbuilders.org','2026-06-02 23:55:58');
INSERT INTO "site_settings" ("key","value","updated_at") VALUES('phone','+44 20 7946 0000','2026-06-02 23:55:58');
INSERT INTO "site_settings" ("key","value","updated_at") VALUES('address','12 Cathedral Way, West End, London, SW1E 5RS','2026-06-02 23:55:58');
INSERT INTO "site_settings" ("key","value","updated_at") VALUES('service_times','[{"name":"Sunday Morning","time":"09:00 AM","note":"Traditional"},{"name":"Sunday Evening","time":"05:30 PM","note":"Contemporary"},{"name":"Midweek Communion","time":"07:00 PM","note":"Wednesday"}]','2026-06-02 23:55:58');
INSERT INTO "site_settings" ("key","value","updated_at") VALUES('socials','{"facebook":"","instagram":"","youtube":""}','2026-06-02 23:55:58');
INSERT INTO "site_settings" ("key","value","updated_at") VALUES('default_theme','purple','2026-06-02 23:55:58');
CREATE TABLE ministries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  image_key TEXT,
  leader TEXT,
  meeting_time TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
INSERT INTO "ministries" ("id","name","slug","description","image_key","leader","meeting_time","sort_order","published","created_at","updated_at","updated_by") VALUES(1,'Worship & Arts','worship-arts','Soulful music and creative expression that lifts the congregation in adoration.',NULL,'Grace Adeyemi','Sundays',1,1,'2026-06-02 23:55:58','2026-06-02 23:55:58',NULL);
INSERT INTO "ministries" ("id","name","slug","description","image_key","leader","meeting_time","sort_order","published","created_at","updated_at","updated_by") VALUES(2,'Kharis Kids','kharis-kids','A safe, fun, spiritually enriching environment for ages 2-11 during the 09:00 AM service.',NULL,'Sarah Bello','Sundays 09:00 AM',2,1,'2026-06-02 23:55:58','2026-06-02 23:55:58',NULL);
INSERT INTO "ministries" ("id","name","slug","description","image_key","leader","meeting_time","sort_order","published","created_at","updated_at","updated_by") VALUES(3,'Youth & Young Adults','youth','Building the next generation of leaders rooted in faith and purpose.',NULL,'David Okafor','Fridays 07:00 PM',3,1,'2026-06-02 23:55:58','2026-06-02 23:55:58',NULL);
INSERT INTO "ministries" ("id","name","slug","description","image_key","leader","meeting_time","sort_order","published","created_at","updated_at","updated_by") VALUES(4,'Community Outreach','outreach','Serving our city through compassion, generosity, and practical care.',NULL,'Ruth Mensah','Monthly',4,1,'2026-06-02 23:55:58','2026-06-02 23:55:58',NULL);
CREATE TABLE visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  visiting_service TEXT,
  type TEXT NOT NULL DEFAULT 'visitor',
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'visit_form',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sermons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  speaker TEXT,
  series TEXT,
  scripture_ref TEXT,
  video_url TEXT NOT NULL,
  video_provider TEXT NOT NULL DEFAULT 'youtube',
  thumbnail_key TEXT,
  description TEXT,
  sermon_date TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
, transcript TEXT);
INSERT INTO "sermons" ("id","title","slug","speaker","series","scripture_ref","video_url","video_provider","thumbnail_key","description","sermon_date","published","created_at","updated_at","updated_by","transcript") VALUES(1,'The Architecture of Faith: Part IV','architecture-of-faith-4','Lead Pastor','Architecture of Faith','Hebrews 11','https://www.youtube.com/watch?v=dQw4w9WgXcQ','youtube',NULL,'Building a life that lasts on an unshakeable foundation.','2024-10-27',1,'2026-06-03 00:44:57','2026-06-03 00:44:57',NULL,NULL);
INSERT INTO "sermons" ("id","title","slug","speaker","series","scripture_ref","video_url","video_provider","thumbnail_key","description","sermon_date","published","created_at","updated_at","updated_by","transcript") VALUES(2,'A Place to Belong','a-place-to-belong','Lead Pastor','Foundations','Psalm 133','https://www.youtube.com/watch?v=dQw4w9WgXcQ','youtube',NULL,'Why community is the heart of the church.','2024-10-20',1,'2026-06-03 00:44:57','2026-06-03 00:44:57',NULL,NULL);
INSERT INTO "sermons" ("id","title","slug","speaker","series","scripture_ref","video_url","video_provider","thumbnail_key","description","sermon_date","published","created_at","updated_at","updated_by","transcript") VALUES(3,'Grace That Builds','grace-that-builds','Guest Speaker','Foundations','Ephesians 2','https://www.youtube.com/watch?v=dQw4w9WgXcQ','youtube',NULL,'Grace is the foundation every destiny is built on.','2024-10-13',1,'2026-06-03 00:44:57','2026-06-03 00:44:57',NULL,NULL);
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  location TEXT,
  image_key TEXT,
  registration_enabled INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
INSERT INTO "events" ("id","title","slug","category","description","start_at","end_at","location","image_key","registration_enabled","capacity","published","created_at","updated_at","updated_by") VALUES(1,'First Steps Luncheon','first-steps-luncheon','Community','For our new members to meet the leadership team and understand our vision.','2999-11-03 12:30:00',NULL,'The Glass Atrium',NULL,1,60,1,'2026-06-03 00:44:57','2026-06-03 00:44:57',NULL);
INSERT INTO "events" ("id","title","slug","category","description","start_at","end_at","location","image_key","registration_enabled","capacity","published","created_at","updated_at","updated_by") VALUES(2,'Night of Adoration','night-of-adoration','Worship','An immersive acoustic worship experience designed for deep spiritual renewal.','2999-11-08 19:00:00',NULL,'Main Auditorium',NULL,1,200,1,'2026-06-03 00:44:57','2026-06-03 00:44:57',NULL);
INSERT INTO "events" ("id","title","slug","category","description","start_at","end_at","location","image_key","registration_enabled","capacity","published","created_at","updated_at","updated_by") VALUES(3,'Builders Masterclass','builders-masterclass','Leadership','Developing practical leadership skills rooted in eternal biblical principles.','2999-11-15 10:00:00',NULL,'Chapel',NULL,0,NULL,1,'2026-06-03 00:44:57','2026-06-03 00:44:57',NULL);
CREATE TABLE event_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  guests INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
INSERT INTO "funds" ("id","name","slug","description","sort_order","active","created_at","updated_at","updated_by") VALUES(1,'General Offering','general-offering','Support the general work and mission of the church.',1,1,'2026-06-03 21:35:33','2026-06-03 21:35:33',NULL);
INSERT INTO "funds" ("id","name","slug","description","sort_order","active","created_at","updated_at","updated_by") VALUES(2,'Tithe','tithe','Return your tithe to the storehouse.',2,1,'2026-06-03 21:35:33','2026-06-03 21:35:33',NULL);
INSERT INTO "funds" ("id","name","slug","description","sort_order","active","created_at","updated_at","updated_by") VALUES(3,'Building Fund','building-fund','Help us build and maintain our place of worship.',3,1,'2026-06-03 21:35:33','2026-06-03 21:35:33',NULL);
INSERT INTO "funds" ("id","name","slug","description","sort_order","active","created_at","updated_at","updated_by") VALUES(4,'Missions & Outreach','missions-outreach','Fuel local and global outreach.',4,1,'2026-06-03 21:35:33','2026-06-03 21:35:33',NULL);
CREATE TABLE donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  fund_id INTEGER REFERENCES funds(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'one_time',
  status TEXT NOT NULL DEFAULT 'pending',
  channel TEXT,
  paystack_status TEXT,
  paid_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL);
CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  interval TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_ref TEXT NOT NULL UNIQUE,
  subscription_code TEXT UNIQUE,
  email_token TEXT,
  customer_code TEXT,
  customer_email TEXT NOT NULL,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  interval TEXT NOT NULL,
  fund_id INTEGER REFERENCES funds(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  next_payment_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sermon_study_guides (
  sermon_id INTEGER PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  guide_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "sermon_study_guides" ("sermon_id","content_hash","guide_json","generated_at") VALUES(1,'1ec11948a6d7db68777fb47883e506ae090a65a85df473b4fb52166f3f47cd07','{"summary":"In the final part of the Architecture of Faith series, Lead Pastor explores the concept of faith as the foundation of a lasting life, using Hebrews 11 as the guiding scripture. This chapter highlights the faith of various biblical figures and their unwavering trust in God. By examining their stories, we can learn how to build a life that stands firm on the unshakeable foundation of faith.","keyPoints":["Faith is the foundation of a lasting life","Hebrews 11 showcases the faith of various biblical figures","Faith is demonstrated through actions and obedience","God rewards faith with eternal life and blessings"],"reflectionQuestions":["What are some ways I can demonstrate my faith in my daily life?","How can I apply the stories of biblical figures in Hebrews 11 to my own life?","What are some areas in my life where I need to strengthen my faith?","How can I trust God more fully in difficult circumstances?"],"relatedScriptures":["Hebrews 11:1-40","Romans 4:20-21","2 Corinthians 5:7","Matthew 17:20"]}','2026-06-04 00:04:14');
CREATE TABLE page_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.hero_kicker','Welcome Home','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.hero_line1','Building Lives,','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.hero_line2','Shaping Destinies.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.cta1_label','Join Us This Sunday','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.cta1_href','/visit','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.cta2_label','Watch Online','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.cta2_href','/sermons','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.gathering_schedule','[{"day":0,"hour":9,"min":0,"label":"Sunday · 9:00 AM"},{"day":0,"hour":17,"min":30,"label":"Sunday · 5:30 PM"},{"day":3,"hour":19,"min":0,"label":"Wednesday · 7:00 PM"}]','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.pastor_eyebrow','A Word of Welcome','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.pastor_heading','A Message from Our Pastor','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.pastor_body1','Welcome to Kharisbuilders. We believe that every individual has a divine blueprint — a destiny waiting to be realized. Our mission is to provide the spiritual foundation and community support needed to build that life.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.pastor_body2','Whether you are exploring faith for the first time or seeking a deeper connection with your Creator, there is a place for you in our sanctuary. We are more than a congregation; we are architects of hope.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.pastor_name','Lead Pastor David Anderson','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.scripture_verse','Now faith is the substance of things hoped for, the evidence of things not seen.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.scripture_ref','Hebrews 11:1','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.giving_eyebrow','Generosity','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.giving_heading','Invest in Destinies','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.giving_body','Your generosity fuels our mission to build lives and shape destinies. Together, we can make an eternal impact on our community and beyond.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.giving_cta1_label','Give Online','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.giving_cta2_label','Plan a Visit','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.hero_image','/images/home-1.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.pastor_image','/images/home-2.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.scripture_image','/images/home-7.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('home.giving_image','/images/home-7.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('about.hero_kicker','Our Identity','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('about.hero_title','Architects of Faith, Builders of Destinies','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('about.vision_heading','The Vision','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('about.vision_body','To see every life constructed on the unshakeable foundation of grace, transforming individuals into living monuments of God''s presence within their spheres of influence.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('about.mission_heading','The Mission','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('about.mission_body','We are committed to building people through the precise teaching of the Word, the warmth of communal fellowship, and the strategic deployment of spiritual gifts for societal impact.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('about.hero_image','/images/about-1.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('about.vision_image','/images/about-2.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.hero_kicker','Plan Your Visit','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.hero_title','A Place to Belong','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.hero_subtitle','Experience the intersection of tradition and transformation. We can''t wait to welcome you home.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.plan_eyebrow','First Time?','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.plan_heading','Plan Your Visit','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.plan_body','Let us know you''re coming so we can have a welcome pack ready and help you find your way.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.parking_body','Free on-site parking is available, with assistance for elderly visitors.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_eyebrow','Your First Visit','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_heading','What to Expect','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_q1_title','What should I wear?','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_q1_body','We value your presence more than your attire. You''ll find some people in suits and others in jeans — wear whatever makes you feel comfortable and ready to connect with the community.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_kids_title','Kids?','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_kids_body','Our ''Kharis Kids'' program offers a safe, fun, and spiritually enriching environment for ages 2–11 during the morning service.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_service_title','The Service?','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_service_body','Services typically last 75 minutes — soulful music, communal prayer, and a message both ancient in truth and modern in application.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_afterward_title','Afterward','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.expect_afterward_body','Join us in the Glass Atrium for artisanal coffee and a chance to meet our leadership team.','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.hero_image','/images/visit-1.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('visit.afterward_image','/images/visit-2.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('pages.sermons_hero','/images/home-3.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('pages.events_hero','/images/home-4.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('pages.ministries_hero','/images/ministries-1.jpg','2026-06-04 00:00:00','kharis-backfill');
INSERT INTO "page_content" ("key","value","updated_at","updated_by") VALUES('pages.giving_hero','/images/home-2.jpg','2026-06-04 00:00:00','kharis-backfill');
CREATE TABLE leaders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
INSERT INTO "leaders" ("id","name","role","image_key","sort_order","created_at","updated_at","updated_by") VALUES(1,'Dr. Samuel A. Kharis','Founding Pastor',NULL,1,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
INSERT INTO "leaders" ("id","name","role","image_key","sort_order","created_at","updated_at","updated_by") VALUES(2,'Pastor Elena Kharis','Executive Pastor',NULL,2,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
INSERT INTO "leaders" ("id","name","role","image_key","sort_order","created_at","updated_at","updated_by") VALUES(3,'Min. David Chen','Worship & Arts',NULL,3,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
CREATE TABLE journey (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
INSERT INTO "journey" ("id","year","title","body","image_key","sort_order","created_at","updated_at","updated_by") VALUES(1,'2012','The First Cornerstone','Kharisbuilders began as a small gathering of twelve in a downtown studio, united by a vision for architectural spiritual growth.',NULL,1,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
INSERT INTO "journey" ("id","year","title","body","image_key","sort_order","created_at","updated_at","updated_by") VALUES(2,'2017','Expanding the Walls','Our community grew to five hundred, leading us to our current sanctuary — a space designed to facilitate spiritual encounter and professional excellence.',NULL,2,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
INSERT INTO "journey" ("id","year","title","body","image_key","sort_order","created_at","updated_at","updated_by") VALUES(3,'2024','Shaping the Future','Launching our digital global campus and the ''Builders Academy,'' training leaders for the next generation of societal transformation.',NULL,3,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
CREATE TABLE home_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eyebrow TEXT,
  title TEXT NOT NULL,
  description TEXT,
  href TEXT NOT NULL,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
INSERT INTO "home_cards" ("id","eyebrow","title","description","href","image_key","sort_order","created_at","updated_at","updated_by") VALUES(1,'New Here?','Plan a Visit','Know what to expect and let us welcome you home.','/visit',NULL,1,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
INSERT INTO "home_cards" ("id","eyebrow","title","description","href","image_key","sort_order","created_at","updated_at","updated_by") VALUES(2,'Messages','Watch Sermons','Catch up on recent messages, anytime, anywhere.','/sermons',NULL,2,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
INSERT INTO "home_cards" ("id","eyebrow","title","description","href","image_key","sort_order","created_at","updated_at","updated_by") VALUES(3,'Generosity','Give','Partner with the mission and the ministries.','/giving',NULL,3,'2026-06-04 14:27:36','2026-06-04 14:27:36',NULL);
CREATE TABLE online_attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE prayer_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  request TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, pray_count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  day TEXT,
  time TEXT,
  location TEXT,
  format TEXT NOT NULL DEFAULT 'in_person',
  audience TEXT NOT NULL DEFAULT 'everyone',
  leader TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE TABLE group_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER,
  group_name TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE volunteer_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL DEFAULT 'general',
  commitment TEXT NOT NULL DEFAULT 'as_needed',
  schedule TEXT,
  requirements TEXT,
  leader TEXT,
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE TABLE volunteer_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER,
  role_name TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',25);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('ministries',4);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('sermons',3);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('events',3);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('funds',4);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('leaders',3);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('journey',3);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('home_cards',3);
CREATE INDEX idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_fund ON donations(fund_id);
CREATE INDEX idx_donations_created ON donations(created_at);
CREATE UNIQUE INDEX idx_plans_key ON plans(amount, interval, currency);
CREATE INDEX idx_subs_corr ON subscriptions(customer_email, plan_code);
CREATE INDEX idx_subs_status ON subscriptions(status);

-- Prayer Wall: a per-request "I prayed" counter.
ALTER TABLE prayer_requests ADD COLUMN pray_count INTEGER NOT NULL DEFAULT 0;

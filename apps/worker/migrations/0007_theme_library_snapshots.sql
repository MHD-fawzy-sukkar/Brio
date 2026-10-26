-- Keep preserved quiz snapshots out of the reusable theme library.
ALTER TABLE competition_identities ADD COLUMN library_hidden INTEGER NOT NULL DEFAULT 0;

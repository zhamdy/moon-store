-- 007_scheduled_jobs.sql
-- Single-execution semantics for background maintenance.
--
-- Until now the only scheduled work in this system -- expiring stock reservations --
-- ran from a `setInterval` inside every API process. One process is fine; two are not.
-- Every instance woke on its own timer and ran the same DELETE against the same rows,
-- so the maintenance cost scaled with the number of web dynos rather than with the
-- amount of work, and nothing recorded whether a run had happened or how it went.
--
-- This table is the claim ledger that fixes both. A run claims its slot with ONE
-- conditional upsert:
--
--   INSERT INTO scheduled_jobs (name, last_started_at, ...)
--   VALUES ($1, NOW(), ...)
--   ON CONFLICT (name) DO UPDATE SET last_started_at = NOW(), ...
--     WHERE scheduled_jobs.last_started_at <= NOW() - <interval>
--   RETURNING name;
--
-- Under READ COMMITTED a second instance racing the same statement blocks on the row
-- lock, then re-evaluates the DO UPDATE WHERE against the *updated* row -- which now
-- carries the winner's `last_started_at` -- and matches nothing. It returns zero rows
-- and skips. No extra table, no external scheduler, no Redis: the claim is the lock.
--
-- The runner ALSO takes a session-level advisory lock around the whole run. The claim
-- row alone prevents duplicate work inside one interval; the advisory lock additionally
-- prevents two runs *overlapping* when a job outlives its own interval. They guard
-- different failures and are both cheap.
--
-- Columns other than the claim exist to make the job observable: `last_status` and
-- `last_detail` are what a run reports, and `run_count` / `failure_count` are what an
-- operator (or a health probe) reads without trawling logs. A failed run leaves
-- `last_started_at` set, so the retry is the next interval -- deliberate: a job that
-- fails fast in a tight loop is a worse outage than one that waits five minutes.
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  name TEXT PRIMARY KEY,
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  last_status TEXT,
  last_detail TEXT,
  run_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0
);

-- 0047 — saved filter views (owner, 2026-10-15): a named set of a page's filters
-- (its URL query string), shared by everyone who opens the report. The welding
-- pages share one list ("/welding"), every other report has its own (its path).
CREATE TABLE IF NOT EXISTS saved_view (
  id          bigserial PRIMARY KEY,
  page        text NOT NULL,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  query       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page, name)
);

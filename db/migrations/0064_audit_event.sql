-- The activity log (owner, 2026-10-28): who signed in, refreshed data, changed shared settings or
-- users, downloaded exports — with the IP and the request (passwords removed).
CREATE TABLE audit_event (
  id      bigserial   PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  email   text        NOT NULL DEFAULT '',
  action  text        NOT NULL,
  status  integer     NOT NULL,
  ip      text        NOT NULL DEFAULT '',
  detail  jsonb       NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_event_at_idx ON audit_event (at DESC);

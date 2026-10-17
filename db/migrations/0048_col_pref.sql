-- 0048 — table column preferences (owner, 2026-10-17): a column's hand-set width
-- (dragged on the header's right edge, the header text wraps like in Power BI)
-- and a renamed header, shared by everyone. A table is keyed by its original
-- column list, so the same table on every sub-contractor page shares them.
CREATE TABLE IF NOT EXISTS col_pref (
  table_key   text NOT NULL CHECK (length(table_key) BETWEEN 1 AND 4000),
  col         text NOT NULL CHECK (length(col) BETWEEN 1 AND 300),
  label       text CHECK (label IS NULL OR length(btrim(label)) BETWEEN 1 AND 120),
  width       integer CHECK (width IS NULL OR width BETWEEN 24 AND 1200),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_key, col)
);

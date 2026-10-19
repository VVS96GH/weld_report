-- 0057 — PMI(%) and HT(%) from the CCC Joint Record (owner, 2026-10-19), for the
-- pbix's `PMI% CCC` / `HT% CCC` and their "PR All" columns on the Data page —
-- as MT% / PT% CCC already are (MAXX over the Joint Record by Joint ID "JR").
ALTER TABLE ccc_joint_pwht
  ADD COLUMN IF NOT EXISTS pmi_pct integer,
  ADD COLUMN IF NOT EXISTS ht_pct  integer;
ALTER TABLE weld
  ADD COLUMN IF NOT EXISTS pmi_pct_ccc integer,
  ADD COLUMN IF NOT EXISTS ht_pct_ccc  integer;

-- 0036 — `weld_manual_exclusion.rt_pct`: the RT% of the four M-excluded joints.
--
-- WHY ------------------------------------------------------------------------
-- The pbix M step #"EXLUDE 4 RT B.log CCC" removes four hard-coded Joint IDs
-- from the union `Project WD+WR+INCO+Acciona`, and our CCC loaders honour that:
-- those rows never enter `weld`. Correct, and migration 0012 already records
-- the list so the exclusion is visible rather than buried in a loader.
--
-- But the step filters the UNION. It does not filter `TALISMAN DATA`, and
-- `[RT BACKLOG RT100% Talisman]` reads
--
--   CALCULATE(DISTINCTCOUNT('TALISMAN DATA'[Joint ID]),
--             'TALISMAN DATA'[WELD DATE] > 0,
--             'TALISMAN DATA'[RT% from Project WD+WR] = 100,
--             'TALISMAN DATA'[RT1 REP NO] = "")
--
-- All four excluded joints ARE in `sources/Joint.csv` with a weld date and a
-- blank RT1 REP NO, and in the pbix their `RT% from Project WD+WR` still
-- resolves. Ours cannot: the lookup reads `mv_joint`, from which the M step
-- removed them. That is the whole of the card's 357 against the owner's 358 —
-- exactly one of the four, `11060A4-PR6206008-SP3-11`, carries RT/UT(%) = 100
-- in the welder record (verified by streaming the raw 1.5 GB CSV).
--
-- This column gives the Talisman lookup somewhere to resolve those four
-- joints. It CANNOT move any union measure: `weld` and `mv_joint` are not
-- touched, the rows still never load, and nothing but the Talisman card reads
-- it. Every existing pin is unaffected by construction.
--
-- NOT a licence to reinstate the rows. The M excludes them from the union
-- deliberately — "ручная правка данных «чтобы бэклог сошёлся»", per
-- analysis/pbix/project-wd-wr-inco-acciona.md:167 — and the RT backlog of 672
-- depends on that exclusion holding.

ALTER TABLE weld_manual_exclusion ADD COLUMN IF NOT EXISTS rt_pct integer;

COMMENT ON COLUMN weld_manual_exclusion.rt_pct IS
  'RT/UT(%) of this joint in the CCC welder record, captured at load time by scripts/load-exclusion-list.ts. Exists so [RT BACKLOG RT100% Talisman] can resolve `RT% from Project WD+WR` for joints the M step removed from the union — TALISMAN DATA is not subject to that step. Read by nothing else; it cannot move a union measure.';

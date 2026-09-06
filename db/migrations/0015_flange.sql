-- 0015 — the flange register.
--
-- A DIFFERENT FACT FROM `weld`, and deliberately a separate table (RF-06): the
-- grain is a flanged joint, not a weld, the two never join, and nothing in
-- `lib/metrics/*` should ever union them.
--
-- Evidence: analysis/flange/{rulings,plan,pbix-flange,workbooks,mockup-vs-sources}.md
-- and analysis/flange/metrics.json. Rulings RF-01 … RF-09 are binding.
--
-- GRAIN (RF-06): one row per REGISTER LINE — 363,245 rows over 357,787 distinct
-- joint ids, because 5,458 joints are listed twice. **Every joint metric is
-- `count(DISTINCT joint_id)`, never `count(*)`.**
--
-- THE UNION IS AN APPEND, NOT A JOIN. The pbix's `Flange Progress` is
-- `Table.Combine({Flange Progress.xlsx, Flange ovAssets_1619})`; the two files
-- share ZERO joint ids (measured intersection 0), so `source` partitions the
-- table cleanly: 136,741 GAC/TEKFEN/MEDGULF rows and 226,504 CCC rows.
--
-- No materialised view (RF-09): measure first, at 363k rows.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flange_source') THEN
    -- Room for the two exports that are not in sources/ yet (_1510, _1381).
    CREATE TYPE flange_source AS ENUM ('FLANGE_PROGRESS', 'OVASSETS_1619');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS flange (
  id                       bigserial     PRIMARY KEY,
  load_id                  bigint        NOT NULL REFERENCES load(id) ON DELETE CASCADE,
  source                   flange_source NOT NULL,

  -- ── identity ────────────────────────────────────────────────────────────
  -- Flange Progress: [Iso Number] & "-" & [BT No.]    ovAssets: [FlangeJointName]
  joint_id                 text NOT NULL,
  iso_number               text,
  bt_no                    text,   -- ovAssets derives it: List.Last(Split(joint_id,"-"))
  rev_no                   text,
  sheet_no                 text,
  joint_point              text,

  -- ── scope / location ────────────────────────────────────────────────────
  test_pack                text,
  system                   text,
  subsystem                text,
  pds_area                 text,   -- FP: Text.BeforeDelimiter(iso_number,"-")  ov: WeldAreaName
  process_plant            text,   -- ovAssets only — the HA source for CCC (RF-03)
  process_area             text,   -- ovAssets only
  ha                       text,   -- HA1..HA4 or NULL; see the note below
  sub_contractor           text,   -- 'CCC' hard-set for every ovAssets row, as the M does
  commissioning_package    text,
  line_no                  text,   -- ovAssets only

  -- ── the flange itself ───────────────────────────────────────────────────
  diam                     text,   -- text: FP has '.75', ov has '0.75' — not normalised
  rating                   text,
  service_class            text,   -- ov: Spec
  material_id_code         text,   -- ovAssets only
  bolt_size                text,
  bolt_qty                 text,
  bolt_length              text,
  bolt_ident               text,
  bolt_desc                text,   -- ov: Stud Material
  gasket_desc              text,   -- ov: Gasket Type
  gasket_rating            text,   -- ovAssets only
  lubricant_type           text,
  service_type             text,
  ut                       text,

  -- ── jointing ────────────────────────────────────────────────────────────
  joint_method             text,   -- normalised: Manual | Torquing | Tensioning | TBN
  joint_method_original    text,   -- pre-normalisation, only Tensionning->Tensioning applied
  joint_timing             text,   -- FP sourced; ov derived from cat (X/Y/Z -> ... else TBN)
  cat                      text,   -- `Cat.`; '' -> 'TBN'. 75.3% filled on the CCC side (RF-07)
  jointing_value           text,   -- ov: FL - Torque Value
  torque_eu                text,   -- ovAssets only
  joint_date               date,   -- "inspected" is joint_date IS NOT NULL
  report_nbr               text,
  jointer                  text,   -- ov: Crew ID
  tag_nbr                  text,
  tightening_tool_id       text,
  control_pct              integer,

  -- ── control inspection ──────────────────────────────────────────────────
  flange_batch_no          text,
  selected_date            date,
  issued_date              date,
  issue_request_no         text,
  batch_status             text,
  flange_joint_status      text,   -- INS / FH / FS / FHS / FSS — FP only, '' on all CCC rows
  control_inspection_report_no text,
  control_inspection_date  date,   -- ov: Verified Date
  status_ar                text,   -- `Status - A/R` (the sheet spells it with a trailing space)
  client_requested         text,
  witnessed_by             text,
  acc_rej                  text,
  remarks                  text,
  btc01                    text,
  bt24                     text,
  reason                   text,

  -- ── de-tightening / leaks ───────────────────────────────────────────────
  -- `reason_for_de_tightening = 'FLANGE LEAKAGE'` is the leak measure. Compare it
  -- CASE-INSENSITIVELY: the ovAssets side stores 'Flange Leakage' and the M's two
  -- ReplaceText steps ("Flange leaking"/"Flange leakage") are case-SENSITIVE and
  -- miss it. DAX string equality is case-insensitive, so the pbix counts those 119
  -- rows; `upper(reason_for_de_tightening) = 'FLANGE LEAKAGE'` reproduces it.
  reason_for_de_tightening text,
  user_requested_for_de_tightening text,
  de_tightening_requested_date date,
  hold_status              text,
  hold_date                date,
  hold_comments            text,

  -- ── PCC (pre-commissioning) — ovAssets only, and the second half of the
  --     Const-n / PCC measure pair ─────────────────────────────────────────
  pcc_serial_no_field_tag  text,
  pcc_tightening_date      date,   -- the column the Const-n / PCC split keys on
  pcc_report_number        text,
  pcc_verified_date        date,
  pcc_re_tightening_date   date,
  pcc_re_tightening_report_number text,
  pcc_crew_id              text,
  pcc_remarks              text,

  -- ── ovAssets housekeeping ───────────────────────────────────────────────
  re_tightening_report_number text,
  flange_repair_record     text,   -- 0 non-blank of 226,504 — the repair link the logs would use
  nut_material             text,
  parent_asset             text,
  record_modified_by       text,
  record_modified_date     date,
  construction_responsible_company text,
  commissioning_responsible_company text
);

COMMENT ON TABLE flange IS
  'The flange register: Flange Progress.xlsx (GAC/TEKFEN/MEDGULF) appended with ovAssets_1619.xlsx (CCC), exactly as the pbix Table.Combine does. Grain is one REGISTER LINE, 363,245 rows over 357,787 distinct joint_id — every joint metric must be count(DISTINCT joint_id). Never joins `weld`.';
COMMENT ON COLUMN flange.ha IS
  'HA1..HA4 or NULL. Flange Progress side: the DAX rule MID([System],2,1). CCC side: parsed from ovAssets [Process Plant] (RF-03) — it agrees with the DAX rule on 226,438/226,504 rows with 0 disagreements. NULL where unresolved: the HA l0_abs_guide fallback (912 rows) is ABSENT, so those joints belong in a visible "(blank)" bucket, never folded into HA1.';
COMMENT ON COLUMN flange.cat IS
  'Only 75.3% filled on the CCC side, which is why the mockup uses the "CCC no cat" measure pair that exempts CCC from the Cat. test (RF-07). Do not use the plain Cat.-for-everyone trio: it zeroes CCC.';
COMMENT ON COLUMN flange.sub_contractor IS
  'GAC / TEKFEN / MEDGULF / TBD from Flange Progress; hard-set to CCC for every ovAssets_1619 row, as the M does. ACCIONA rows are dropped at load, as the M does.';

CREATE INDEX IF NOT EXISTS flange_joint        ON flange (joint_id);
CREATE INDEX IF NOT EXISTS flange_subcon       ON flange (sub_contractor);
CREATE INDEX IF NOT EXISTS flange_ha           ON flange (ha);
CREATE INDEX IF NOT EXISTS flange_method       ON flange (joint_method);
CREATE INDEX IF NOT EXISTS flange_source_idx   ON flange (source);
CREATE INDEX IF NOT EXISTS flange_load         ON flange (load_id);
CREATE INDEX IF NOT EXISTS flange_joint_date   ON flange (joint_date);
CREATE INDEX IF NOT EXISTS flange_scope        ON flange (sub_contractor, ha, joint_method);
CREATE INDEX IF NOT EXISTS flange_pcc_date     ON flange (pcc_tightening_date) WHERE pcc_tightening_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS flange_detighten    ON flange (reason_for_de_tightening) WHERE reason_for_de_tightening IS NOT NULL;

-- ===========================================================================
-- ref_ha — created EMPTY (RF-03)
-- ===========================================================================
-- `HA l0_abs_guide` (912 rows, from `l0_abs_guide_202502191028.csv`) is absent.
-- It is the fallback the DAX HA rule uses when [System] is blank or
-- "System-NA - Not Applicable". Without it 6,593 of 357,787 joint ids (1.84%)
-- would have no HA; using ovAssets [Process Plant] for the CCC side (RF-03) cuts
-- that to ~4,403. The table exists so the loader can start using it the day the
-- file arrives, and so nothing invents an HA in the meantime.
CREATE TABLE IF NOT EXISTS ref_ha (
  location_number text PRIMARY KEY,   -- joins flange.pds_area
  handover_area   text,               -- HA1..HA4
  notes           text,
  load_id         bigint REFERENCES load(id) ON DELETE SET NULL
);
COMMENT ON TABLE ref_ha IS
  'EMPTY BY DESIGN until l0_abs_guide_202502191028.csv arrives (912 rows). The DAX HA fallback LOOKUPVALUEs it by Location Number = flange.pds_area. Absence is why some flange.ha are NULL; do not fill them from anything else.';

-- ===========================================================================
-- load.source vocabulary
-- ===========================================================================
ALTER TABLE load DROP CONSTRAINT IF EXISTS load_source_vocabulary;
ALTER TABLE load ADD CONSTRAINT load_source_vocabulary CHECK (source IN (
  -- fact sources (also weld_source enum values)
  'WELD_DUMP', 'CCC_WELDER_RECORD', 'CCC_JOINT_RECORD', 'ACCIONA', 'INCO',
  -- dimension / reference sources
  'SPOOL_DUMP', 'TALISMAN_SPOOL', 'WEEKLY_SNAPSHOT', 'UT_TRACKER_CCC',
  'EXCLUSION_LIST', 'MPI_DONE', 'ACTIVE_WELDERS',
  'WELD_LENGTH', 'WPS_REGISTER', 'QUALIFIED_WELDERS',
  -- batch 3
  'WELDERS_SCTR', 'WELDERS_QUALIFICATION', 'WELDER_STATUS_WEEKLY', 'CODE_LABELS',
  -- flange
  'FLANGE_PROGRESS', 'OVASSETS_1619'
));

/**
 * The data refresh steps (scripts/refresh-data.ts) — shared with the Sources page
 * (app/sources, app/api/sources): which files each step reads, what it forces, and
 * which `load.source` rows it writes.
 */
import { TREND_RT_PWHT_FILE } from "../scripts/lib/source-path";
import { cumFile } from "./welder-perf-cum";

export interface Step {
  /** Shown on the Sources page. */
  title: string;
  /** `load.source` values this step writes (Sources page: rows and last load). */
  loads: string[];
  id: string;
  /** npm script that loads it. */
  script: string;
  /** Input files, relative to the repo root. */
  files: string[];
  /** Inputs the loader itself treats as optional. */
  optional?: string[];
  /** Steps that must run again once this one has. */
  forces?: string[];
  /** true when the step changes a table the joint matviews read. */
  matviews?: boolean;
  /** Runs after the single matview refresh (it reads `mv_joint`). */
  afterMatviews?: boolean;
  about: string;
}

export const WELD_DUMP = process.env.WELD_DUMP_PATH ?? "sources/Weld Dump.txt";

export const STEPS: Step[] = [
  { id: "weld-dump", title: "Weld Dump (GAC / TEKFEN / MEDGULF)", loads: ["WELD_DUMP"],
    script: "db:load", files: [WELD_DUMP],
    forces: ["weld-length"], matviews: true, about: "Weld Dump (GAC / TEKFEN / MEDGULF)" },
  { id: "snapshot", title: "Weekly trend workbooks (CUM)", loads: ["WEEKLY_SNAPSHOT", "MPI_DONE", "ACTIVE_WELDERS"],
    script: "db:seed:snapshot", files: [
      TREND_RT_PWHT_FILE,
      "sources/CUM Trend RT% UT% RejRate/CUM Trend RT% UT% RejRate.xlsx",
      "sources/CUM Trend Active Welders/CUM Trend Active Welders.xlsx",
      "sources/CUM MPI Done .xlsx",
    ], about: "weekly trend workbooks" },
  { id: "spool", title: "Spool masters (Spool Dump + CCC Spool.csv)", loads: ["SPOOL_DUMP", "TALISMAN_SPOOL"],
    script: "db:load:spool", files: ["sources/Spool Dump.txt", "sources/Spool.csv"],
    matviews: true, about: "spool masters" },
  { id: "ccc-joints", title: "CCC Joint Record (AllTrain)", loads: ["CCC_JOINT_RECORD"],
    script: "db:load:ccc-joints",
    files: ["sources/AllTrain_CSVExport_Joint Record.csv"],
    forces: ["ccc"], matviews: true, about: "CCC joint record" },
  { id: "ccc", title: "CCC Welder Record (CSV + ACC/REJ)", loads: ["CCC_WELDER_RECORD"],
    script: "db:load:ccc", files: [
      "sources/CSVExport_Welder Record.csv",
      "sources/CSVExport_Welder Record - FOR PIC UPDATE  (ACC  REJ ).xlsx",
    ], forces: ["weld-length", "exclusions"], matviews: true, about: "CCC welder record (~7 min)" },
  { id: "ut-ccc", title: "UT Tracker (CCC)", loads: ["UT_TRACKER_CCC"],
    script: "db:load:ut-ccc", files: ["sources/UT TRACKER (CCC)_Talisman.xlsx"],
    matviews: true, about: "CCC UT tracker + overlay" },
  { id: "ut-trackers", title: "UT Trackers GAC / TEK", loads: [],
    script: "db:load:ut-trackers",
    files: ["sources/UT TRACKER (GAC)_Master.xlsx", "sources/UT TRACKER (TEK).xlsx"],
    about: "UT trackers GAC / TEK (CTJV verification columns)" },
  { id: "exclusions", title: "Exclusion list", loads: ["EXCLUSION_LIST"],
    script: "db:load:exclusions", files: ["sources/TO BE EXLUDE FROM DATA.xlsx"],
    about: "exclusion list" },
  { id: "acciona", title: "Acciona", loads: ["ACCIONA"],
    script: "db:load:acciona",
    files: ["sources/Acciona/Acciona_Latest Add to Query.xlsx"],
    forces: ["weld-length"], matviews: true, about: "Acciona" },
  { id: "inco", title: "Inco", loads: ["INCO"],
    script: "db:load:inco", files: ["sources/Inco/Master Weld_Latest.xlsx"],
    forces: ["weld-length"], matviews: true, about: "Inco" },
  { id: "weld-length", title: "Weld Length (reference)", loads: ["WELD_LENGTH", "CODE_LABELS"],
    script: "db:load:weld-length", files: [
      "sources/Weld Length/Weld Length.xlsx", "sources/Weld Length/Rework code.xlsx",
    ], matviews: true, about: "dia -> weld length, weld_length_m" },
  { id: "welders", title: "Welder registers", loads: ["WELDERS_SCTR", "WELDERS_QUALIFICATION", "WELDER_STATUS_WEEKLY"],
    script: "db:load:welders", files: [
      "sources/Welders/SCTR NFE WELDERS APPLIED.xls",
      "sources/Welders/Welders Power Q for PBI .xlsx",
    ], about: "welder registers" },
  { id: "ha-guide", title: "HA guide", loads: ["HA_L0_GUIDE", "HA_GUIDE"],
    script: "db:load:ha-guide", files: ["sources/l0_abs_guide.csv"],
    optional: ["sources/HA.csv"], matviews: true, about: "HA guide" },
  { id: "wps", title: "WPQ / WPS registers", loads: ["WPS_REGISTER", "WPS_STATUS_CUM", "WPS_PWHT_STATUS", "WPS_PROCESS"],
    script: "db:load:wps", files: [
      "sources/WPQ RECORD REGISTER/WPQ RECORD REGISTER.xlsx",
      "sources/WPQ RECORD REGISTER/CUM WPS Status.xlsx",
      "sources/WPQ RECORD REGISTER/WPS PWHT Status.xlsx",
    ], afterMatviews: true, about: "WPQ register" },
  // the workbooks are found whatever the spacing of their names (lib/welder-perf-cum.ts cumFile)
  { id: "welder-cum", title: "Welder Performance CUM workbooks", loads: ["WELDER_PERF_CUM"],
    script: "db:load:welder-cum", files: [cumFile("2w"), cumFile("1m"), cumFile("ut2w")],
    about: "welder performance CUM workbooks (trend charts)" },
  { id: "flange", title: "Flange register (Flange Progress + ovAssets)", loads: ["FLANGE_PROGRESS", "OVASSETS_1619"],
    script: "db:load:flange",
    files: ["sources/Flange Progress.xlsx", "sources/ovAssets_1619.xlsx"],
    afterMatviews: true, about: "flange register" },
  { id: "flange-breakdown", title: "Flange break-down weekly rate", loads: [],
    script: "db:load:flange-breakdown",
    files: ["sources/CUM Trend Flange Progress Break Down Rate %.xlsx"], about: "flange break-down weekly rate" },
  { id: "talisman", title: "Talisman Joint (CCC)", loads: ["TALISMAN_JOINT"],
    script: "db:load:talisman", files: ["sources/Joint.csv"],
    afterMatviews: true, about: "Talisman joints" },
];

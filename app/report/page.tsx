import { redirect } from "next/navigation";

/** /report → the first screen of consolidation option A. */
export default function ReportIndex() {
  redirect("/report/overview");
}

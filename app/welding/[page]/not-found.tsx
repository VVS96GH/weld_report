import Link from "next/link";

import { WELDING_TOTAL_PAGES } from "@/lib/welding-pages";

export default function WeldingPageNotFound() {
  return (
    <section className="page-section active">
      <div className="page-header">
        <h2>Page not found</h2>
      </div>
      <p style={{ marginBottom: 16 }}>
        This report has pages 1 through {WELDING_TOTAL_PAGES}.
      </p>
      <Link href="/welding/1" className="nav-btn">
        Go to page 1
      </Link>
    </section>
  );
}

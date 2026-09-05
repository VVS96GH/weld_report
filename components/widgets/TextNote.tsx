import type { TextWidget } from "@/lib/page-model";

/**
 * Renders a free-form text widget as a `.card`, reusing the mockup's reference-card
 * look (e.g. the "Defect Code Reference" / "WELD TYPE Reference" cards on page 2).
 *
 * The mockup authored these as a `.card-header` plus a list of `<strong>code:</strong>
 * description` lines; the PageModel only carries a single flat `text` string, so this
 * splits on the first ": " to recover a header when the text reads like "Label: body"
 * and falls back to plain body text otherwise (e.g. page 4's
 * "GAC WELDING STATUS (SLG Service Only)" sub-heading, which has no such split).
 */
export function TextNote({ widget }: { widget: TextWidget }) {
  const splitAt = widget.text.indexOf(": ");
  const hasHeader = splitAt > 0 && splitAt < 60;
  const header = hasHeader ? widget.text.slice(0, splitAt) : null;
  const body = hasHeader ? widget.text.slice(splitAt + 2) : widget.text;

  return (
    <div className="card">
      {header ? <div className="card-header">{header}</div> : null}
      <div className="text-note-body">{body}</div>
    </div>
  );
}

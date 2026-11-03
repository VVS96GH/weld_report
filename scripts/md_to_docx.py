"""docs/database.md -> .docx (headings, tables, paragraphs). uv run --with python-docx python scripts/md_to_docx.py in.md out.docx"""

import sys

from docx import Document
from docx.shared import Pt


def main(src: str, dst: str) -> None:
    doc = Document()
    doc.styles["Normal"].font.size = Pt(9)
    rows: list[list[str]] = []

    def flush() -> None:
        if not rows:
            return
        head = rows[0]
        body = [r for r in rows[1:] if not all(set(c) <= set("-:") for c in r)]
        t = doc.add_table(rows=1 + len(body), cols=len(head))
        t.style = "Light Grid Accent 1"
        for i, r in enumerate([head, *body]):
            for j, v in enumerate(r[: len(head)]):
                t.cell(i, j).text = v.replace("`", "")
        rows.clear()

    for line in open(src, encoding="utf-8").read().splitlines():
        if line.startswith("|"):
            rows.append([c.strip() for c in line.strip("|").split("|")])
            continue
        flush()
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            doc.add_heading(line.lstrip("# ").replace("`", ""), level=min(level, 3))
        elif line.strip():
            doc.add_paragraph(line.strip().replace("`", "").replace("**", ""))
    flush()
    doc.save(dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

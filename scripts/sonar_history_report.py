#!/usr/bin/env python3
"""
sonar_history_report.py
สร้างรายงาน PDF จากโฟลเดอร์ docs/sonarqube-history (ผลของ sonar_history.py)
  - report.pdf ในโฟลเดอร์ของแต่ละรอบ: ค่าวัด, การเปลี่ยนแปลงจากรอบก่อน, สรุปตาม rule/ไฟล์ และรายการ issue ทั้งหมด
  - sonarqube-history-report.pdf: สรุปแนวโน้มทุกรอบ

การใช้งาน:
    python3 scripts/sonar_history_report.py [docs/sonarqube-history]
ต้องมี Google Chrome (ใช้พิมพ์ HTML เป็น PDF) กำหนดตำแหน่งเองได้ด้วยตัวแปร CHROME
"""

import glob
import html
import json
import os
import subprocess
import sys
import tempfile
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", "sonarqube-history")
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
TITLE = "เว็บไซต์และระบบจัดการเนื้อหา อยู่เย็นเป็นสุข"
SEVERITIES = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"]
TYPES = [("BUG", "Bug"), ("VULNERABILITY", "Vulnerability"), ("CODE_SMELL", "Code smell")]
QG = {"OK": "ผ่าน", "ERROR": "ไม่ผ่าน"}
QG_CONDITION = {"New Issues > 0": "มี issue ใหม่ในโค้ดใหม่", "Coverage on New Code < 80": "Coverage ของโค้ดใหม่ต่ำกว่า 80%"}


def qg_text(run):
    qg = QG.get(run.get("qualityGate"), "-")
    why = run.get("qualityGateFailedConditions")
    return f"{qg} ({', '.join(QG_CONDITION.get(c.strip(), c.strip()) for c in why.split(','))})" if why else qg

CSS = """
@page { size: A4; margin: 18mm 16mm 18mm 16mm;
  @bottom-center { content: counter(page) " / " counter(pages); font: 11pt 'TH Sarabun New'; color: #667; } }
* { box-sizing: border-box; }
body { font-family: 'TH Sarabun New', Thonburi, sans-serif; font-size: 15pt; color: #1d2a22; margin: 0; line-height: 1.25; }
h1 { font-size: 26pt; margin: 0 0 2pt; color: #123c24; }
h2 { font-size: 19pt; margin: 16pt 0 6pt; color: #123c24; border-bottom: 1.5pt solid #2e7d3b; padding-bottom: 2pt; break-after: avoid; }
.sub { color: #4a5a4f; font-size: 15pt; margin-bottom: 10pt; }
table { width: 100%; border-collapse: collapse; font-size: 13.5pt; }
th, td { border: 0.6pt solid #c9d6c4; padding: 2pt 5pt; vertical-align: top; text-align: left; }
th { background: #174d2b; color: #fff; font-weight: bold; }
tr:nth-child(even) td { background: #f3f7f1; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
td.n, th.n { text-align: right; white-space: nowrap; }
td.c, th.c { text-align: center; }
.info td:first-child { width: 28%; font-weight: bold; background: #eef4eb; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6pt; margin: 6pt 0; }
.card { border: 0.8pt solid #c9d6c4; border-radius: 6pt; padding: 4pt 8pt; break-inside: avoid; }
.card b { display: block; font-size: 22pt; color: #123c24; line-height: 1.1; }
.card span { font-size: 12.5pt; color: #4a5a4f; }
.card.ok b { color: #2e7d3b; } .card.bad b { color: #b3261e; }
.msg { font-size: 12.5pt; } .file { font-family: Menlo, monospace; font-size: 8pt; word-break: break-all; }
.rule { font-family: Menlo, monospace; font-size: 8pt; white-space: nowrap; }
.none { padding: 10pt; border: 0.8pt dashed #9bb59a; border-radius: 6pt; color: #2e7d3b; font-size: 16pt; text-align: center; }
.note { background: #fff8e1; border-left: 3pt solid #e0a800; padding: 4pt 8pt; margin: 6pt 0; }
.small { font-size: 12.5pt; color: #4a5a4f; }
"""


def esc(x):
    return html.escape("" if x is None else str(x))


def load_issues(folder):
    issues = []
    for f in sorted(glob.glob(os.path.join(OUT, folder, "issues_page*.json")),
                    key=lambda p: int(p.rsplit("page", 1)[1].split(".")[0])):
        with open(f, encoding="utf-8") as fh:
            issues += json.load(fh)["issues"]
    return issues


def pct(v):
    return f"{float(v):.1f}%" if v not in (None, "") else "-"


def path_of(issue):
    return issue["component"].split(":", 1)[1]


def card(value, label, cls=""):
    return f'<div class="card {cls}"><b>{esc(value)}</b><span>{esc(label)}</span></div>'


def table(head, rows, cls=None, widths=None):
    cls = cls or [""] * len(head)
    cols = "<colgroup>" + "".join(f'<col style="width:{w}%">' for w in widths) + "</colgroup>" if widths else ""
    out = ["<table>" + cols + "<thead><tr>" + "".join(f'<th class="{c}">{h}</th>' for h, c in zip(head, cls)) + "</tr></thead><tbody>"]
    for r in rows:
        out.append("<tr>" + "".join(f'<td class="{c}">{v}</td>' for v, c in zip(r, cls)) + "</tr>")
    return "".join(out) + "</tbody></table>"


def run_report(run, issues, prev, prev_issues, rules):
    hours = run["effortTotalMinutes"] / 60
    qg = run.get("qualityGate")
    parts = [f"<h1>รายงานผลสแกน SonarQube รอบที่ {run['run']}</h1>",
             f'<div class="sub">{TITLE} · {esc(run["analysisDateBangkok"])} (เวลาไทย)</div>',
             table(["รายการ", "ค่า"], [
                 ["โปรเจกต์ (projectKey)", f'<span class="file">{esc(run["project"])}</span>'],
                 ["โค้ดรุ่น", esc(run["codeVersion"])],
                 ["รหัสการวิเคราะห์ (analysisKey)", f'<span class="file">{esc(run["analysisKey"])}</span>'],
                 ["โฟลเดอร์ข้อมูล", f'<span class="file">{esc(run["folder"])}/issues_page1–{run["pages"]}.json</span>'],
                 ["Quality Gate", esc(qg_text(run))],
                 ["หมายเหตุ", esc(run["note"]) or "-"]]).replace("<table>", '<table class="info">', 1),
             "<h2>ค่าวัดของรอบนี้</h2>", '<div class="cards">',
             card(QG.get(qg, qg or "-"), "Quality Gate", "ok" if qg == "OK" else "bad" if qg == "ERROR" else ""),
             card(f'{run["total"]:,}', "issue ที่ยังเปิดอยู่", "ok" if run["total"] == 0 else ""),
             card(run["bugs"], "Bug"), card(run["vulnerabilities"], "Vulnerability"),
             card(f'{run["codeSmells"]:,}', "Code smell"),
             card(pct(run.get("coverage")), f'Coverage (บรรทัด {pct(run.get("lineCoverage"))} · ทางแยก {pct(run.get("branchCoverage"))})'),
             card(pct(run.get("duplicatedLinesDensity")), "โค้ดซ้ำ (Duplication)"),
             card(f'{run.get("linesOfCode") or 0:,}', "บรรทัดโค้ด (ncloc)"),
             card(run.get("reliabilityRating") or "-", "Reliability rating"),
             card(run.get("securityRating") or "-", "Security rating"),
             card(run.get("maintainabilityRating") or "-", "Maintainability rating"),
             card(f"{hours:,.1f} ชม.", "เวลาที่ประเมินว่าต้องใช้แก้ (effort)"),
             "</div>"]
    if run.get("coverage") in ("0.0", None):
        parts.append('<div class="note small">Coverage 0.0% หมายถึงรอบนี้ยังไม่ได้ส่งผล coverage จากการทดสอบให้ SonarQube</div>')

    parts.append("<h2>การเปลี่ยนแปลงจากรอบก่อน</h2>")
    if prev is None:
        parts.append(f'<p>เป็นรอบแรกของโปรเจกต์ <span class="file">{esc(run["project"])}</span> จึงไม่มีรอบก่อนให้เทียบ</p>')
    else:
        now = {i["key"] for i in issues}
        before = {i["key"] for i in prev_issues}
        new, gone = now - before, before - now
        parts.append(table(["", f'รอบที่ {prev["run"]}', f'รอบที่ {run["run"]}', "ผลต่าง"], [
            [label, f'{prev[k]:,}', f'{run[k]:,}', f'{run[k] - prev[k]:+,}']
            for label, k in [("issue ที่เปิดอยู่", "total"), ("Bug", "bugs"), ("Vulnerability", "vulnerabilities"),
                             ("Code smell", "codeSmells")]], ["", "n", "n", "n"]))
        parts.append(f'<p>issue ที่พบใหม่ในรอบนี้ <b>{len(new):,}</b> รายการ · issue จากรอบก่อนที่ปิดไป (แก้แล้วหรือตรวจทานแล้วรับไว้) '
                     f'<b>{len(gone):,}</b> รายการ</p>')

    if not issues:
        parts.append("<h2>รายการ issue</h2><div class=\"none\">ไม่มี issue ที่ยังเปิดอยู่ในรอบนี้</div>")
        return "".join(parts)

    sev = Counter((i["type"], i["severity"]) for i in issues)
    parts.append("<h2>จำนวน issue ตามประเภทและความรุนแรง</h2>")
    parts.append(table(["ประเภท"] + SEVERITIES + ["รวม"],
                       [[name] + [str(sev[(t, s)] or "-") for s in SEVERITIES] + [str(sum(sev[(t, s)] for s in SEVERITIES))]
                        for t, name in TYPES], [""] + ["n"] * 6))

    by_rule = Counter(i["rule"] for i in issues)
    parts.append("<h2>จำนวน issue ตาม rule</h2>")
    parts.append(table(["rule", "คำอธิบาย rule", "จำนวน"],
                       [[f'<span class="rule">{esc(r)}</span>', esc(rules.get(r, "")), f"{c:,}"] for r, c in by_rule.most_common()],
                       ["", "", "n"], [20, 68, 12]))

    by_file = Counter(path_of(i) for i in issues)
    parts.append("<h2>จำนวน issue ตามไฟล์</h2>")
    parts.append(table(["ไฟล์", "จำนวน"], [[f'<span class="file">{esc(f)}</span>', f"{c:,}"] for f, c in by_file.most_common()],
                       ["", "n"]))

    parts.append(f"<h2>รายการ issue ทั้งหมด ({len(issues):,} รายการ)</h2>")
    parts.append(table(["#", "ไฟล์:บรรทัด", "rule", "ประเภท / ความรุนแรง", "ข้อความ"],
                       [[str(n), f'<span class="file">{esc(path_of(i))}:{i.get("line", "-")}</span>',
                         f'<span class="rule">{esc(i["rule"])}</span>',
                         f'{dict(TYPES)[i["type"]]}<br><span class="small">{i["severity"]}</span>',
                         f'<span class="msg">{esc(i["message"])}</span>']
                        for n, i in enumerate(issues, 1)], ["n", "", "", "", ""], [6, 29, 14, 14, 37]))
    return "".join(parts)


def chart(runs):
    w, h, left, bottom, top = 680, 270, 44, 40, 40
    plot_w, plot_h = w - left - 44, h - bottom - top
    peak = max(r["total"] for r in runs) or 1
    step = plot_w / len(runs)
    bars, pts, labels = [], [], []
    for k, r in enumerate(runs):
        x = left + k * step
        bh = plot_h * r["total"] / peak
        bars.append(f'<rect x="{x + step * 0.18:.1f}" y="{top + plot_h - bh:.1f}" width="{step * 0.64:.1f}" height="{bh:.1f}" fill="#7fb77e"/>')
        bars.append(f'<text x="{x + step / 2:.1f}" y="{top + plot_h - bh - 3:.1f}" font-size="11" text-anchor="middle" fill="#123c24">{r["total"]}</text>')
        cov = float(r.get("coverage") or 0)
        pts.append(f"{x + step / 2:.1f},{top + plot_h * (1 - cov / 100):.1f}")
        labels.append(f'<text x="{x + step / 2:.1f}" y="{h - bottom + 16}" font-size="12" text-anchor="middle">{r["run"]}</text>')
    axis = (f'<line x1="{left}" y1="{top + plot_h}" x2="{w - 44}" y2="{top + plot_h}" stroke="#667"/>'
            f'<text x="{left - 6}" y="{top + 8}" font-size="11" text-anchor="end">{peak}</text>'
            f'<text x="{left - 6}" y="{top + plot_h}" font-size="11" text-anchor="end">0</text>'
            f'<text x="{w - 38}" y="{top + 8}" font-size="11">100%</text>'
            f'<text x="{w - 38}" y="{top + plot_h}" font-size="11">0%</text>'
            f'<text x="{left + plot_w / 2}" y="{h - 4}" font-size="13" text-anchor="middle">รอบที่</text>')
    legend = ('<rect x="50" y="4" width="12" height="10" fill="#7fb77e"/><text x="66" y="13" font-size="12">issue ที่เปิดอยู่ (แกนซ้าย)</text>'
              '<line x1="230" y1="9" x2="252" y2="9" stroke="#b3261e" stroke-width="2"/><text x="256" y="13" font-size="12">Coverage (แกนขวา)</text>')
    line = f'<polyline points="{" ".join(pts)}" fill="none" stroke="#b3261e" stroke-width="2"/>' + "".join(
        f'<circle cx="{p.split(",")[0]}" cy="{p.split(",")[1]}" r="2.5" fill="#b3261e"/>' for p in pts)
    return (f'<svg viewBox="0 0 {w} {h}" width="100%" style="font-family:\'TH Sarabun New\'">'
            + legend + axis + "".join(bars) + line + "".join(labels) + "</svg>")


def summary_report(runs, accepted):
    first, last = runs[0], runs[-1]
    parts = ["<h1>รายงานสรุปผลสแกน SonarQube ทุกรอบ</h1>",
             f'<div class="sub">{TITLE} · {len(runs)} รอบ ตั้งแต่ {esc(first["analysisDateBangkok"][:16])} '
             f'ถึง {esc(last["analysisDateBangkok"][:16])} (เวลาไทย)</div>',
             '<div class="cards">',
             card(f'{max(r["total"] for r in runs):,}', "issue ที่เปิดอยู่สูงสุด"),
             card(f'{last["total"]:,}', "issue ที่เปิดอยู่รอบล่าสุด", "ok" if last["total"] == 0 else ""),
             card(pct(last.get("coverage")), "Coverage รอบล่าสุด"),
             card(QG.get(last.get("qualityGate"), "-"), "Quality Gate รอบล่าสุด", "ok" if last.get("qualityGate") == "OK" else "bad"),
             "</div>", "<h2>แนวโน้มจำนวน issue และ Coverage</h2>", chart(runs),
             "<h2>สรุปแต่ละรอบ</h2>",
             table(["รอบ", "เวลา (ไทย)", "โค้ด", "QG", "issue", "Bug", "Vuln.", "Smell", "Cov.", "R/S/M", "หมายเหตุ"],
                   [[str(r["run"]), esc(r["analysisDateBangkok"][5:16]), esc(r["folder"].rsplit("_", 1)[1]),
                     QG.get(r.get("qualityGate"), "-"), f'{r["total"]:,}', str(r["bugs"]), str(r["vulnerabilities"]),
                     f'{r["codeSmells"]:,}', pct(r.get("coverage")),
                     f'{r.get("reliabilityRating") or "-"}/{r.get("securityRating") or "-"}/{r.get("maintainabilityRating") or "-"}',
                     f'<span class="small">{esc(r["note"])}</span>'] for r in runs],
                   ["c", "", "", "c", "n", "n", "n", "n", "n", "c", ""]),
             '<p class="small">QG = Quality Gate · R/S/M = Reliability / Security / Maintainability rating · '
             "รายละเอียดของแต่ละรอบอยู่ในไฟล์ report.pdf ของโฟลเดอร์รอบนั้น</p>"]
    if accepted:
        parts.append(f"<h2>issue ที่ตรวจทานแล้วรับไว้ ({len(accepted)} รายการ)</h2>")
        parts.append(table(["rule", "ไฟล์:บรรทัด", "เหตุผล"],
                           [[f'<span class="file">{esc(a["rule"])}</span>', f'<span class="file">{esc(a["file"])}:{a["line"]}</span>',
                             f'<span class="msg">{esc(a["reason"])}</span>'] for a in accepted]))
    return "".join(parts)


def to_pdf(body, pdf):
    doc = f'<!doctype html><html lang="th"><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}</body></html>'
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(doc)
    try:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf}", "file://" + f.name], check=True, capture_output=True)
    finally:
        os.unlink(f.name)


def main():
    with open(os.path.join(OUT, "runs.json"), encoding="utf-8") as f:
        runs = json.load(f)
    rules, accepted = {}, []
    if os.path.exists(os.path.join(OUT, "rules.json")):
        with open(os.path.join(OUT, "rules.json"), encoding="utf-8") as f:
            rules = json.load(f)
    if os.path.exists(os.path.join(OUT, "accepted.json")):
        with open(os.path.join(OUT, "accepted.json"), encoding="utf-8") as f:
            accepted = json.load(f)
    prev_by_project = {}
    for run in runs:
        issues = load_issues(run["folder"])
        prev, prev_issues = prev_by_project.get(run["project"], (None, []))
        to_pdf(run_report(run, issues, prev, prev_issues, rules), os.path.join(OUT, run["folder"], "report.pdf"))
        prev_by_project[run["project"]] = (run, issues)
    to_pdf(summary_report(runs, accepted), os.path.join(OUT, "sonarqube-history-report.pdf"))
    print(f"สร้างรายงาน PDF {len(runs)} รอบ และรายงานสรุปแล้ว")


if __name__ == "__main__":
    main()

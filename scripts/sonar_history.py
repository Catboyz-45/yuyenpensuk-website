#!/usr/bin/env python3
"""
sonar_history.py
สร้างโฟลเดอร์ docs/sonarqube-history/ เก็บ issue ที่ยังเปิดอยู่ของ "ทุกรอบ" ที่สแกนด้วย SonarQube
แต่ละรอบมี issues_page1.json, issues_page2.json, ... (หน้าละ 200 รายการ)
รูปแบบเดียวกับผลของ GET /api/issues/search?componentKeys=<project>&ps=200&p=N

SonarQube เก็บเฉพาะสถานะล่าสุดของ issue จึงต้องไล่ประวัติการเปลี่ยนสถานะ (issue_changes)
ในฐานข้อมูลของ SonarQube ย้อนกลับไปถึงเวลาของแต่ละรอบ แล้วตรวจจำนวนกับค่า violations ของรอบนั้น

การใช้งาน:
    python3 scripts/sonar_history.py
ตัวแปรแวดล้อม (ไม่ใส่ก็ได้):
    SONAR_HOST=http://localhost:9000  SONAR_TOKEN=<token ถ้าไม่มีไฟล์ ~/.sonar_token>
    SONAR_DB_CONTAINER=nestly_sonarqube_db  OUT=docs/sonarqube-history
"""

import base64
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

HOST = os.environ.get("SONAR_HOST", "http://localhost:9000")
TOKEN_FILE = os.path.expanduser("~/.sonar_token")
TOKEN = open(TOKEN_FILE).read().strip() if os.path.exists(TOKEN_FILE) else os.environ["SONAR_TOKEN"]
DB = os.environ.get("SONAR_DB_CONTAINER", "nestly_sonarqube_db")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("OUT", os.path.join(ROOT, "docs", "sonarqube-history"))
PAGE = 200
BKK = timezone(timedelta(hours=7))

# รหัสโปรเจกต์ใน SonarQube เรียงตามลำดับเวลา: ชื่อย่อที่ต่อท้ายโฟลเดอร์, คำอธิบาย
PROJECTS = [
    ("yuyenpensuk-website-v1", "v1", "โค้ดรุ่นแรกจากเครื่องผู้พัฒนา (website_YS)"),
    ("yuyenpensuk-website-prod", "prod", "โค้ดรุ่นที่ใช้งานจริงบนเครื่องแม่ข่าย (commit a7350ab)"),
    ("yuyenpensuk-website-fix", "fix", "โค้ดรุ่นแก้ไขหลังทดสอบ (commit 2a325c8 และรอบก่อนหน้า)"),
]
OPEN_STATUSES = {"OPEN", "CONFIRMED", "REOPENED"}
# ค่าวัดที่เก็บไว้ใน runs.json ต่อรอบ: ชื่อ metric ใน SonarQube -> ชื่อ field
METRICS = {"violations": "sonarqubeViolationsMeasure", "alert_status": "qualityGate", "coverage": "coverage",
           "line_coverage": "lineCoverage", "branch_coverage": "branchCoverage",
           "duplicated_lines_density": "duplicatedLinesDensity", "ncloc": "linesOfCode",
           "reliability_rating": "reliabilityRating", "security_rating": "securityRating",
           "sqale_rating": "maintainabilityRating", "security_hotspots": "securityHotspots"}
RULE_NAMES = {}
RATING = {"1.0": "A", "2.0": "B", "3.0": "C", "4.0": "D", "5.0": "E"}
# หมายเหตุของรอบที่มีเหตุการณ์สำคัญ (อ้างด้วย analysisKey ซึ่งไม่เปลี่ยนเมื่อสร้างใหม่)
NOTES = {
    "bc107bbd-4569-4eb2-96d6-dc45441101db": "จุดตั้งต้น: โค้ดรุ่นแรก ยังไม่วัด coverage",
    "a74834c4-241d-460d-87be-9c2ae75d02ef": "โค้ดที่ใช้งานจริงก่อนแก้ ใช้เป็นค่าก่อนแก้ในรายงาน",
    "340feda0-800f-42af-9c3c-4764d0a19197": "รอบแรกของโค้ดรุ่นแก้ไข issue ใน routes/ scripts/ utils/ ลดลงจากการแก้ JavaScript ก่อนสแกน",
    "d7406aac-b53a-436e-81e0-bc5557f3f6a8": "แก้ selector ซ้ำใน CSS (css:S4666) และ Bug ที่เหลือ",
    "75b5882b-1c54-4ce0-b1d1-c2cf1ed13219": "เหลือ javascript:S5693 (จำกัดไฟล์ 10 MB) ซึ่งรับไว้หลังรอบนี้",
    "f6a5ff02-0690-4392-9c4b-7782eada5ea7": "เริ่มส่ง coverage จากการรัน Robot Framework (c8 + istanbul)",
    "a1ae66c6-968d-4cca-a671-cba1ee6aa7c6": "สร้าง CSS ใหม่จากไฟล์ต้นฉบับ เพราะการรวม selector รอบก่อนทำให้หน้าเว็บเพี้ยน "
                                            "css:S4666 จึงกลับมา หลังรอบนี้รับไว้ 12 รายการ ที่เหลือแก้โดยตรวจลำดับ cascade",
    "8d06e535-5b28-44ac-b8fa-280f7fbe67e8": "เพิ่ม Unit Test 38 กรณี และ Robot หลังบ้านเป็น 60 กรณี",
    "b1c288fa-0e07-486d-b227-5a85412fdfac": "โค้ดย่อรายการยี่ห้อใน public/js/main.js มี 2 code smell แก้ในรอบถัดไป",
}
# field ตามลำดับเดียวกับผล API ของ SonarQube
FIELDS = ["key", "rule", "severity", "component", "project", "line", "hash", "textRange", "flows",
          "resolution", "status", "message", "effort", "debt", "author", "tags", "creationDate",
          "updateDate", "type", "scope", "quickFixAvailable", "messageFormattings", "codeVariants",
          "cleanCodeAttribute", "cleanCodeAttributeCategory", "impacts", "issueStatus",
          "prioritizedRule", "fromSonarQubeUpdate", "internalTags", "linkedTicketStatus"]


def api(path):
    req = urllib.request.Request(HOST + path)
    req.add_header("Authorization", "Basic " + base64.b64encode((TOKEN + ":").encode()).decode())
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def sql(query):
    out = subprocess.run(["docker", "exec", DB, "psql", "-U", "sonar", "-d", "sonar", "-At", "-F", "\t", "-c", query],
                         capture_output=True, text=True, check=True).stdout
    return [line.split("\t") for line in out.splitlines() if line]


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+0000")


def parse_iso(s):
    return int(datetime.strptime(s, "%Y-%m-%dT%H:%M:%S%z").timestamp() * 1000)


def all_issues(key):
    """issue ทุกตัวของโปรเจกต์ รวมที่ปิดแล้ว (ค่าล่าสุด)"""
    issues, comps, p = [], {}, 1
    while True:
        d = api(f"/api/issues/search?componentKeys={key}&ps=500&p={p}&additionalFields=_all")
        issues += d["issues"]
        for c in d["components"]:
            comps[c["key"]] = c
        for rule in d.get("rules", []):
            RULE_NAMES[rule["key"]] = rule["name"]
        if p * 500 >= d["paging"]["total"]:
            return issues, comps
        p += 1


def changes(key):
    """ประวัติการเปลี่ยน field ของแต่ละ issue: {issue: [(เวลา, {field: (ก่อน, หลัง)})]}"""
    rows = sql("select c.issue_key, c.issue_change_creation_date, c.change_data from issue_changes c "
               "join project_branches b on b.uuid = c.project_uuid join projects p on p.uuid = b.project_uuid "
               f"where p.kee = '{key}' and c.change_type = 'diff' order by c.issue_change_creation_date")
    hist = {}
    for issue, at, data in rows:
        diff = {}
        for part in data.split(","):
            name, _, val = part.partition("=")
            before, _, after = val.partition("|")
            diff[name] = (before, after)
        hist.setdefault(issue, []).append((int(at), diff))
    return hist


def state_at(issue, hist, at):
    """ย้อนค่า field ของ issue กลับไปที่เวลา at โดยถอยการเปลี่ยนแปลงที่เกิดหลังจากนั้น"""
    st = {"status": issue["status"], "resolution": issue.get("resolution", ""), "line": issue.get("line"),
          "severity": issue["severity"], "issueStatus": issue.get("issueStatus"), "updated": None}
    for when, diff in reversed(hist.get(issue["key"], [])):
        if when <= at:
            st["updated"] = st["updated"] or when
            continue
        for name, (before, _) in diff.items():
            if name == "line":
                st["line"] = int(before) if before else None
            elif name in st:
                st[name] = before
    return st


def build_issue(issue, st, at):
    it = dict(issue)
    it["status"], it["severity"], it["issueStatus"] = st["status"], st["severity"], st["issueStatus"]
    if st["status"] in OPEN_STATUSES:
        it.pop("resolution", None)
    if st["line"] is not None:
        tr = issue.get("textRange")
        if tr and issue.get("line") is not None and st["line"] != issue["line"]:
            shift = st["line"] - issue["line"]
            tr = dict(tr, startLine=tr["startLine"] + shift, endLine=tr["endLine"] + shift)
        it["line"] = st["line"]
        if tr:
            it["textRange"] = tr
    upd = st["updated"] or parse_iso(issue["creationDate"])
    it["updateDate"] = iso(min(upd, at))
    return {k: it[k] for k in FIELDS if k in it}


def minutes(effort):
    total = 0
    for part in effort.replace("d", "d ").replace("h", "h ").replace("min", "min ").split():
        n = int("".join(ch for ch in part if ch.isdigit()) or 0)
        total += n * (480 if part.endswith("d") else 60 if part.endswith("h") else 1)
    return total


def sort_key(i):
    return (i["component"], i.get("line") or 0, i["rule"], i["key"])


def accepted():
    """issue ที่ตรวจทานแล้วรับไว้ (Accepted / False positive) พร้อมเหตุผลจากความคิดเห็น"""
    out = []
    for key, _, _ in PROJECTS:
        d = api(f"/api/issues/search?componentKeys={key}&resolutions=WONTFIX,FALSE-POSITIVE&ps=500&additionalFields=comments")
        for i in d["issues"]:
            out.append((key, i["rule"], i["component"].split(":", 1)[1], i.get("line"),
                        i["comments"][-1]["markdown"] if i.get("comments") else ""))
    return sorted(out, key=lambda a: (a[0], a[2], a[3] or 0))


def write_readme(runs, acc):
    first, last = runs[0]["analysisDateBangkok"][:16], runs[-1]["analysisDateBangkok"][:16]
    lines = ["# ประวัติผลสแกน SonarQube ของเว็บไซต์อยู่เย็นเป็นสุข", "",
             f"แยกโฟลเดอร์ตามรอบที่สแกน ทั้งหมด {len(runs)} รอบ ตั้งแต่ {first} ถึง {last} (เวลาไทย)", "",
             f"แต่ละโฟลเดอร์มี `issues_page1.json`, `issues_page2.json`, … หน้าละ {PAGE} รายการ",
             "รูปแบบเหมือนผลของ `GET /api/issues/search?componentKeys=<project>&ps=200&p=N` ทุก field",
             "คือ issue ที่ยังเปิดอยู่ (ยังไม่แก้) ในรอบนั้น รอบที่ไม่มี issue จะมี `issues_page1.json` ที่ `total` เป็น 0", "",
             "`runs.json` คือสรุปทุกรอบในไฟล์เดียว สร้างใหม่ทั้งโฟลเดอร์ได้ด้วย `python3 scripts/sonar_history.py`", "",
             "## รายงาน PDF", "",
             "- `sonarqube-history-report.pdf` รายงานสรุปทุกรอบ: กราฟแนวโน้ม issue กับ Coverage, ตารางทุกรอบ และ issue ที่รับไว้",
             "- `report.pdf` ในโฟลเดอร์ของแต่ละรอบ: ค่าวัด (Quality Gate, Coverage, rating), การเปลี่ยนแปลงจากรอบก่อน,",
             "  จำนวน issue ตามประเภท/rule/ไฟล์ และรายการ issue ทั้งหมดของรอบนั้น (สร้างด้วย `scripts/sonar_history_report.py`)",
             "- `rules.json` ชื่อเต็มของ rule ที่พบ · `accepted.json` issue ที่ตรวจทานแล้วรับไว้พร้อมเหตุผล", "",
             "## โปรเจกต์ใน SonarQube", "", "| ต่อท้ายชื่อโฟลเดอร์ | projectKey | โค้ดรุ่น |", "|---|---|---|"]
    lines += [f"| `_{tag}` | `{key}` | {desc} |" for key, tag, desc in PROJECTS]
    lines += ["", "## สรุปแต่ละรอบ", "",
              "| รอบ | เวลา (ไทย) | Quality Gate | issue ทั้งหมด | Bug | Vulnerability | Code smell | Coverage | หน้า | โฟลเดอร์ | หมายเหตุ |",
              "|---|---|---|---:|---:|---:|---:|---:|---:|---|---|"]
    for r in runs:
        cov = f'{float(r["coverage"]):.1f}%' if r["coverage"] is not None else "-"
        qg = {"OK": "ผ่าน", "ERROR": "ไม่ผ่าน"}.get(r["qualityGate"], "-")
        if r["qualityGateFailedConditions"]:
            qg += f' ({r["qualityGateFailedConditions"]})'
        lines.append(f'| {r["run"]} | {r["analysisDateBangkok"][:16]} | {qg} | {r["total"]:,} | {r["bugs"]} | '
                     f'{r["vulnerabilities"]} | {r["codeSmells"]:,} | {cov} | {r["pages"]} | `{r["folder"]}` | {r["note"]} |')
    lines += ["", "## issue ที่ตรวจทานแล้วรับไว้ (ไม่นับเป็น issue ที่เปิดอยู่)", "",
              "| projectKey | rule | ไฟล์:บรรทัด | เหตุผล |", "|---|---|---|---|"]
    lines += [f"| `{k}` | `{rule}` | `{path}:{line}` | {why.replace(chr(10), ' ')} |" for k, rule, path, line, why in acc]
    lines += ["", "## หมายเหตุ", "",
              "- **วิธีได้ข้อมูล:** SonarQube เก็บสถานะ issue ล่าสุดไว้อย่างเดียว ไม่ได้เก็บรายการแยกตามรอบ",
              "  ไฟล์ชุดนี้จึงสร้างจากฐานข้อมูลของ SonarQube ในเครื่อง โดยไล่ประวัติการเปลี่ยนสถานะของแต่ละ issue",
              "  (เปิด / ปิด / เปิดซ้ำ / รับไว้ / false positive) ย้อนไปถึงเวลาของแต่ละรอบ",
              f"- **ตรวจความถูกต้องแล้ว:** จำนวน issue ทุกรอบตรงกับค่า `violations` ที่ SonarQube บันทึกไว้ในรอบนั้นครบทั้ง {len(runs)} รอบ",
              "  และรอบล่าสุดของแต่ละโปรเจกต์ตรงกับผลของ API ปัจจุบัน",
              "- Coverage 0.0% คือรอบที่ยังไม่ได้ส่งผล coverage ให้ SonarQube (เริ่มส่งตั้งแต่รอบที่ 6)",
              "- **field ที่ย้อนตามรอบ:** สถานะ, บรรทัด (`line`, `textRange`), severity และ `updateDate`",
              "- **field ที่เป็นค่าล่าสุด:** `message`, `tags`, `effort`, `flows` เพราะ SonarQube ไม่ได้เก็บประวัติของ field เหล่านี้",
              "- `author` ว่างทุกรายการ เพราะสแกนโดยปิดการอ่านประวัติ Git (`sonar.scm.disabled=true`)",
              "- `linkedTicketStatus` เป็น `NOT_LINKED` ทุกรายการ เพราะโปรเจกต์ไม่ได้ผูก ticket", ""]
    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    runs, n = [], 0
    for key, tag, desc in PROJECTS:
        analyses = api(f"/api/project_analyses/search?project={key}&ps=500")["analyses"][::-1]
        hist_m = api(f"/api/measures/search_history?component={key}&metrics={','.join(METRICS)}&ps=500")["measures"]
        measure = {m["metric"]: {h["date"]: h.get("value") for h in m["history"]} for m in hist_m}
        issues, comps = all_issues(key)
        hist = changes(key)
        qg_reason = ""
        # เวลาของรอบเป็นมิลลิวินาทีจากตาราง snapshots (API ปัดเหลือวินาที แต่ประวัติการเปลี่ยนสถานะบันทึกเวลาเดียวกับ snapshot)
        snap = dict(sql(f"select uuid, created_at from snapshots where uuid in ({','.join(repr(a['key']) for a in analyses)})"))
        for a in analyses:
            n += 1
            at = int(snap[a["key"]])
            local = datetime.fromtimestamp(at / 1000, BKK)
            folder = f"run-{n:02d}_{local:%Y-%m-%d_%H%M}_{tag}"
            os.makedirs(os.path.join(OUT, folder))
            opened = []
            for issue in issues:
                if parse_iso(issue["creationDate"]) > at:
                    continue
                st = state_at(issue, hist, at)
                if st["status"] in OPEN_STATUSES:
                    opened.append(build_issue(issue, st, at))
            opened.sort(key=sort_key)
            effort = sum(minutes(i.get("effort", "0min")) for i in opened)
            pages = max(1, -(-len(opened) // PAGE))
            for p in range(1, pages + 1):
                chunk = opened[(p - 1) * PAGE:p * PAGE]
                used = {i["component"] for i in chunk} | {key}
                page = {"total": len(opened), "p": p, "ps": PAGE,
                        "paging": {"pageIndex": p, "pageSize": PAGE, "total": len(opened)},
                        "effortTotal": effort, "issues": chunk,
                        "components": [c for k, c in comps.items() if k in used] or
                                      [{"key": key, "enabled": True, "qualifier": "TRK", "name": key, "longName": key}],
                        "facets": []}
                with open(os.path.join(OUT, folder, f"issues_page{p}.json"), "w", encoding="utf-8") as f:
                    json.dump(page, f, ensure_ascii=False, indent=2)
            types = {t: sum(1 for i in opened if i["type"] == t) for t in ("BUG", "VULNERABILITY", "CODE_SMELL")}
            run = {"run": n, "folder": folder, "project": key, "codeVersion": desc,
                   "analysisKey": a["key"], "analysisDate": a["date"],
                   "analysisDateBangkok": local.strftime("%Y-%m-%d %H:%M:%S"),
                   "total": len(opened), "pages": pages, "bugs": types["BUG"],
                   "vulnerabilities": types["VULNERABILITY"], "codeSmells": types["CODE_SMELL"],
                   "effortTotalMinutes": effort}
            for metric, field in METRICS.items():
                v = measure.get(metric, {}).get(a["date"])
                if v is not None and metric in ("violations", "ncloc", "security_hotspots"):
                    v = int(v)
                run[field] = RATING.get(v, v) if metric.endswith("_rating") else v
            qg_event = [e for e in a.get("events", []) if e["category"] == "QUALITY_GATE"]
            if qg_event:
                qg_reason = qg_event[0].get("description", "")
            run["qualityGateFailedConditions"] = qg_reason if run.get("qualityGate") == "ERROR" else ""
            run["note"] = NOTES.get(a["key"], "")
            runs.append(run)
    with open(os.path.join(OUT, "runs.json"), "w", encoding="utf-8") as f:
        json.dump(runs, f, ensure_ascii=False, indent=2)
    acc = accepted()
    write_readme(runs, acc)
    with open(os.path.join(OUT, "rules.json"), "w", encoding="utf-8") as f:
        json.dump(dict(sorted(RULE_NAMES.items())), f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUT, "accepted.json"), "w", encoding="utf-8") as f:
        json.dump([{"project": k, "rule": rule, "file": path, "line": line, "reason": why}
                   for k, rule, path, line, why in acc], f, ensure_ascii=False, indent=2)
    bad = [r["run"] for r in runs if r["total"] != r["sonarqubeViolationsMeasure"]]
    for r in runs:
        print(f'{r["folder"]:36} {r["total"]:4} (violations {r["sonarqubeViolationsMeasure"]}) '
              f'B{r["bugs"]} V{r["vulnerabilities"]} S{r["codeSmells"]} cov {r["coverage"]}')
    if bad:
        sys.exit(f"จำนวนไม่ตรงกับ violations ในรอบ {bad}")
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "sonar_history_report.py"), OUT], check=True)


if __name__ == "__main__":
    main()

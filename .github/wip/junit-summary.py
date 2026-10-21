"""JUnit XML 결과를 클래스별 테스트 수로 요약한다. 사용: python3 junit-summary.py <폴더>"""
import pathlib
import sys
import xml.etree.ElementTree as ET

total = failed = skipped = 0
for path in sorted(pathlib.Path(sys.argv[1]).glob("TEST-*.xml")):
    suite = ET.parse(path).getroot()
    t, f = int(suite.get("tests", 0)), int(suite.get("failures", 0)) + int(suite.get("errors", 0))
    s = int(suite.get("skipped", 0))
    total, failed, skipped = total + t, failed + f, skipped + s
    print(f"  {suite.get('name')}: {t} tests, {f} failed, {s} skipped")
print(f"TOTAL: {total} tests, {failed} failed, {skipped} skipped")

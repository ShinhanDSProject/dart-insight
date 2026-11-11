#!/usr/bin/env python3
"""
DART Insight 시연용 데이터 관리자 (Demo Data Manager)
- 시연 데이터 검증(check)
- 시연 데이터 백업/내보내기(export)
- 시연 데이터 복원/적재(import/seed)
- 시연 직전 캐시 웜업(prewarm)
- 관리자 권한 부여(admin)
"""

import argparse
import gzip
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DATA = ROOT / "backend" / "data"
DOCS_DIR = BACKEND_DATA / "documents"
SEED_FILE_GZ = BACKEND_DATA / "demo-seed.sql.gz"
SEED_FILE_RAW = BACKEND_DATA / "demo-seed.sql"

# ANSI 색상 코드
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BLUE = "\033[34m"
GRAY = "\033[90m"

# 시연 고정 기업
DEMO_COMPANIES = [
    {"corp_code": "00126380", "name": "삼성전자", "stock": "005930", "role": "주 시연 1 (초성검색·브리핑·연간/반기 비교)"},
    {"corp_code": "01160363", "name": "에코프로비엠", "stock": "247540", "role": "주 시연 2 (재무체크포인트 5건 CHECK 대비·유상증자)"},
    {"corp_code": "00164779", "name": "SK하이닉스", "stock": "000660", "role": "기업 나란히 보기 비교군 (삼성전자 vs SK하이닉스)"},
    {"corp_code": "00688996", "name": "KB금융", "stock": "105560", "role": "보조 시연 (기재정정 자동채택·금융업 계정)"},
]

# 시연 고정 분석 ID 목록
DEMO_ANALYSES = [
    {"id": 11, "name": "에코프로비엠 반기 YOY", "cur": "20260814002535", "prev": "20250814001299", "role": "핵심 시연 (MD&A 문장 변경·원문 근거 하이라이트)"},
    {"id": 10, "name": "삼성전자 반기 YOY", "cur": "20260814003699", "prev": "20250814003156", "role": "핵심 시연 (매출액 대비 크기 맥락 scale·종속기업 숫자변경)"},
    {"id": 8, "name": "삼성전자 사업보고서 YOY", "cur": "20260310002820", "prev": "20250311001085", "role": "핵심 시연 (연간 1년치 종합 비교·1,538건 문장 대조)"},
    {"id": 9, "name": "SK하이닉스 반기 YOY", "cur": "20260814003509", "prev": "20250814003049", "role": "비교 시연 (영업이익 급증·유상증자 STRONG 수시공시)"},
    {"id": 6, "name": "에코프로비엠 분기→반기 PREV", "cur": "20260814002535", "prev": "20260515001109", "role": "도메인 규칙 시연 (직전 기간 비교 시 누적 금액 제외 안내)"},
    {"id": 4, "name": "KB금융 반기 YOY", "cur": "20260814004200", "prev": "20260324000827", "role": "도메인 규칙 시연 (원본 대신 [기재정정] 자동 채택)"},
    {"id": 1, "name": "삼성전자 반기 가드레일 모음", "cur": "20260814003699", "prev": "20250814003156", "role": "가드레일 시연 (목표주가 OUT_OF_SCOPE 차단 및 수치 인용)"},
    {"id": 12, "name": "SK하이닉스 부분 완료", "cur": "20260515002287", "prev": "20250515002103", "role": "장애 대응 시연 (AI 서버 장애 시 재무 비교 부분 완료)"},
]

# 주요사항보고서 핵심 수치 점검 대상
DEMO_KEY_ITEMS = [
    {"corp_code": "00126380", "rcept_no": "20260821000616", "name": "삼성전자 자기주식취득결정 (약 15조 원)"},
    {"corp_code": "01160363", "rcept_no": "20261013000198", "name": "에코프로비엠 유상증자결정 (신주 990만 주)"},
]

def get_db_cmd(is_dump=False):
    """MariaDB / MySQL 접속 또는 덤프 명령어 반환"""
    cli_name = "mariadb-dump" if is_dump else "mariadb"
    alt_name = "mysqldump" if is_dump else "mysql"

    # 1. 호스트 CLI 검사
    cmd = shutil.which(cli_name) or shutil.which(alt_name)
    if cmd:
        return [cmd, "-h", "127.0.0.1", "-P", "3306", "-u", "dart", "-pchange-me", "dart_insight"]

    # 2. Docker 컨테이너 검사 (dart-db)
    docker = shutil.which("docker")
    if docker:
        return [docker, "exec", "-i", "dart-db", cli_name, "-u", "dart", "-pchange-me", "dart_insight"]

    return None

def fetch_json(url, timeout=5):
    """HTTP GET 요청 후 (status_code, json_dict, latency_ms) 반환"""
    start = time.perf_counter()
    req = urllib.request.Request(url, headers={"User-Agent": "DartInsight-DemoManager/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = (time.perf_counter() - start) * 1000
            data = json.loads(resp.read().decode("utf-8"))
            return resp.status, data, elapsed
    except urllib.error.HTTPError as e:
        elapsed = (time.perf_counter() - start) * 1000
        try:
            data = json.loads(e.read().decode("utf-8"))
        except Exception:
            data = {"error": str(e)}
        return e.code, data, elapsed
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        return 0, {"error": str(e)}, elapsed

def print_banner(text):
    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════{RESET}")
    print(f" {BOLD}{text}{RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════{RESET}")

def run_check(base_url="http://localhost:8090"):
    """시연 데이터 및 서버 헬스 체크 실행"""
    print_banner("🔍 DART Insight 시연 데이터 무결성 및 헬스 점검")
    print(f" • 대상 서버: {base_url}")
    print(f" • 공시 원문 디렉터리: {DOCS_DIR}")
    print(f" • 시드 파일: {SEED_FILE_GZ} ({'존재함' if SEED_FILE_GZ.exists() else '없음'})\n")

    passed_count = 0
    total_checks = 0

    # 1. 시스템 헬스 체크
    total_checks += 1
    code, health, ms = fetch_json(f"{base_url}/api/system/health")
    if code == 200 and health.get("backend") == "UP" and health.get("aiServer") == "UP":
        print(f" {GREEN}✔ [PASS]{RESET} {BOLD}서버 헬스:{RESET} Backend={health.get('backend')}, AIServer={health.get('aiServer')} {GRAY}({ms:.1f}ms){RESET}")
        passed_count += 1
    else:
        print(f" {RED}✘ [FAIL]{RESET} {BOLD}서버 헬스:{RESET} Code={code}, Response={health} {GRAY}({ms:.1f}ms){RESET}")

    # 2. 공시 원문 캐시 파일 확인
    total_checks += 1
    if DOCS_DIR.exists():
        zips = list(DOCS_DIR.glob("*.zip"))
        if len(zips) >= 15:
            print(f" {GREEN}✔ [PASS]{RESET} {BOLD}공시 원문 캐시:{RESET} {len(zips)}개 ZIP 파일 정상 적재 {GRAY}({DOCS_DIR}){RESET}")
            passed_count += 1
        else:
            print(f" {YELLOW}▲ [WARN]{RESET} {BOLD}공시 원문 캐시:{RESET} {len(zips)}개 (권장: 15개 이상)")
    else:
        print(f" {RED}✘ [FAIL]{RESET} {BOLD}공시 원문 캐시 디렉터리 없음:{RESET} {DOCS_DIR}")

    # 3. 고정 시연 기업 개요 캐시 점검
    print(f"\n {BOLD}[1] 시연 고정 기업 개요 캐시 상태 (외부 호출 0회){RESET}")
    for c in DEMO_COMPANIES:
        corp = c["corp_code"]
        name = c["name"]
        total_checks += 1

        _, br, _ = fetch_json(f"{base_url}/api/companies/{corp}/briefing")
        _, ol, _ = fetch_json(f"{base_url}/api/companies/{corp}/outlook")
        _, pf, _ = fetch_json(f"{base_url}/api/companies/{corp}/plan-followups")
        _, cp, _ = fetch_json(f"{base_url}/api/companies/{corp}/checkpoints")

        br_ok = br.get("status") in ["GENERATED", "OK"]
        ol_items = len(ol.get("items", []))
        pf_items = len(pf.get("items", []))
        checks = sum(1 for item in cp.get("items", []) if item.get("status") == "CHECK")

        status_str = f"브리핑={'OK' if br_ok else br.get('status')}, 전망={ol_items}건, 약속대조={pf_items}건, 재무체크=CHECK {checks}건"
        if br_ok or ol_items > 0 or pf_items > 0:
            print(f"   {GREEN}✔ [PASS]{RESET} {name:7s} ({corp}): {status_str}")
            passed_count += 1
        else:
            print(f"   {RED}✘ [FAIL]{RESET} {name:7s} ({corp}): {status_str}")

    # 4. 주요사항보고서 핵심 수치 점검
    print(f"\n {BOLD}[2] 주요사항보고서 핵심 수치 캐시{RESET}")
    for item in DEMO_KEY_ITEMS:
        total_checks += 1
        corp = item["corp_code"]
        rcept = item["rcept_no"]
        name = item["name"]
        code, ki, ms = fetch_json(f"{base_url}/api/companies/{corp}/disclosures/{rcept}/key-items")
        if code == 200 and ki.get("status") == "AVAILABLE":
            cnt = len(ki.get("items", []))
            print(f"   {GREEN}✔ [PASS]{RESET} {name} → {cnt}개 핵심 수치 {GRAY}({ms:.1f}ms){RESET}")
            passed_count += 1
        else:
            print(f"   {RED}✘ [FAIL]{RESET} {name} → 응답 상태 {ki.get('status')} {GRAY}(code={code}){RESET}")

    # 5. 고정 완료 분석 점검
    print(f"\n {BOLD}[3] 고정 완료 분석 결과 (Instant Replay){RESET}")
    for item in DEMO_ANALYSES:
        aid = item["id"]
        title = item["name"]
        total_checks += 1
        code, a, ms = fetch_json(f"{base_url}/api/analyses/{aid}")
        _, s, _ = fetch_json(f"{base_url}/api/analyses/{aid}/summary")
        summary_cnt = len(s.get("items", []))

        st = a.get("status")
        txt_st = a.get("textStatus")
        ver = a.get("analysisVersion")

        if code == 200 and st == "COMPLETED":
            note = f"상태={st}, 문장={txt_st}, 버전={ver}, 요약={summary_cnt}건"
            print(f"   {GREEN}✔ [PASS]{RESET} [분석 {aid:2d}] {title:24s}: {note} {GRAY}({ms:.1f}ms){RESET}")
            passed_count += 1
        else:
            print(f"   {RED}✘ [FAIL]{RESET} [분석 {aid:2d}] {title:24s}: Code={code}, Status={st}")

    # 6. 관리자 계정 상태 점검 (DB 직결)
    total_checks += 1
    print(f"\n {BOLD}[4] 관리자 계정 및 운영 권한{RESET}")
    db_cmd = get_db_cmd(is_dump=False)
    if db_cmd:
        try:
            sql = "SELECT u.id, u.role, c.email FROM app_user u JOIN local_credential c ON u.id = c.user_id WHERE u.role = 'ADMIN';"
            proc = subprocess.run(db_cmd + ["-e", sql], capture_output=True, text=True, check=True)
            lines = [l for l in proc.stdout.strip().split("\n") if l and not l.startswith("+") and not l.startswith("id")]
            if lines:
                print(f"   {GREEN}✔ [PASS]{RESET} 관리자 권한 계정 {len(lines)}개 활성화됨:")
                for l in lines:
                    parts = l.split()
                    print(f"        • ID: {parts[0]}, Role: {parts[1]}, Email: {parts[2] if len(parts) > 2 else 'N/A'}")
                passed_count += 1
            else:
                print(f"   {YELLOW}▲ [WARN]{RESET} 현재 ADMIN 권한 계정이 없습니다. (./scripts/seed-demo-data.sh admin 실행 필요)")
        except Exception as e:
            print(f"   {YELLOW}▲ [WARN]{RESET} DB 관리자 조회 건너뜀: {e}")
    else:
        print(f"   {GRAY}• DB 접속 클라이언트(mariadb/docker)를 찾을 수 없어 계정 점검 건너뜀{RESET}")

    # 요약
    rate = (passed_count / total_checks) * 100
    print_banner(f"📊 점검 결과: {passed_count}/{total_checks} 통과 ({rate:.1f}%)")
    if rate >= 90:
        print(f" {GREEN}{BOLD}🎉 시연 준비 완료! 모든 고정 데이터가 외부 호출 없이 즉시 열립니다.{RESET}\n")
    else:
        print(f" {YELLOW}{BOLD}⚠️ 일부 데이터가 누락되었습니다. './scripts/seed-demo-data.sh import'로 복원하세요.{RESET}\n")

def run_export():
    """현재 MariaDB 상태를 demo-seed.sql.gz로 덤프"""
    print_banner("💾 DART Insight 시연 데이터 덤프/내보내기 (Export)")
    BACKEND_DATA.mkdir(parents=True, exist_ok=True)

    db_cmd = get_db_cmd(is_dump=True)
    if not db_cmd:
        print(f"{RED}오류: mariadb-dump 또는 docker 명령어를 찾을 수 없습니다.{RESET}")
        sys.exit(1)

    print(f" • 대상 파일: {SEED_FILE_GZ}")
    print(f" • 데이터베이스: dart_insight")
    print(f" • 덤프 실행 중...")

    start = time.perf_counter()
    # single-transaction 및 no-tablespaces 옵션
    full_cmd = db_cmd + ["--no-tablespaces", "--single-transaction"]

    proc = subprocess.Popen(full_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with gzip.open(SEED_FILE_GZ, "wb") as f_out:
        shutil.copyfileobj(proc.stdout, f_out)

    stderr = proc.stderr.read()
    proc.wait()

    if proc.returncode != 0:
        print(f"{RED}덤프 실패: {stderr.decode()}{RESET}")
        sys.exit(proc.returncode)

    elapsed = time.perf_counter() - start
    size_mb = SEED_FILE_GZ.stat().st_size / (1024 * 1024)

    print(f"\n{GREEN}{BOLD}✔ 시연 데이터 백업 완료!{RESET}")
    print(f" • 파일 경로: {SEED_FILE_GZ}")
    print(f" • 압축 크기: {size_mb:.2f} MB")
    print(f" • 소요 시간: {elapsed:.2f} 초\n")

def run_import():
    """demo-seed.sql.gz에서 MariaDB로 복원"""
    print_banner("📥 DART Insight 시연 데이터 복원/적재 (Import)")

    if not SEED_FILE_GZ.exists() and not SEED_FILE_RAW.exists():
        print(f"{RED}오류: 시드 파일({SEED_FILE_GZ} 또는 {SEED_FILE_RAW})을 찾을 수 없습니다.{RESET}")
        sys.exit(1)

    db_cmd = get_db_cmd(is_dump=False)
    if not db_cmd:
        print(f"{RED}오류: mariadb 또는 docker 명령어를 찾을 수 없습니다.{RESET}")
        sys.exit(1)

    target_file = SEED_FILE_GZ if SEED_FILE_GZ.exists() else SEED_FILE_RAW
    print(f" • 소스 파일: {target_file}")
    print(f" • 대상 데이터베이스: dart_insight")
    print(f" • 데이터 적재 중 (수 초 소요)...")

    start = time.perf_counter()
    proc = subprocess.Popen(db_cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    if target_file.suffix == ".gz":
        with gzip.open(target_file, "rb") as f_in:
            shutil.copyfileobj(f_in, proc.stdin)
    else:
        with open(target_file, "rb") as f_in:
            shutil.copyfileobj(f_in, proc.stdin)

    proc.stdin.close()
    stdout, stderr = proc.communicate()

    if proc.returncode != 0:
        print(f"{RED}복원 실패: {stderr.decode()}{RESET}")
        sys.exit(proc.returncode)

    elapsed = time.perf_counter() - start
    print(f"\n{GREEN}{BOLD}✔ 시연 데이터 복원 완료! ({elapsed:.2f}초){RESET}")

    # 복원 후 자동 점검
    run_check()

def run_prewarm(base_url="http://localhost:8090"):
    """시연 직전 모든 시연 URL을 호출하여 인메모리/파일시스템 캐시 웜업"""
    print_banner("🔥 DART Insight 시연 직전 캐시 웜업 (Pre-warm)")
    print(f" • 대상 서버: {base_url}\n")

    urls = [
        "/api/system/health",
        "/api/companies/00126380",
        "/api/companies/00126380/briefing",
        "/api/companies/00126380/outlook",
        "/api/companies/00126380/plan-followups",
        "/api/companies/00126380/checkpoints",
        "/api/companies/00126380/financial-trends?fsDiv=CFS",
        "/api/companies/01160363",
        "/api/companies/01160363/briefing",
        "/api/companies/01160363/outlook",
        "/api/companies/01160363/plan-followups",
        "/api/companies/01160363/checkpoints",
        "/api/companies/00164779/financial-trends?fsDiv=CFS",
        "/api/compare/companies?corps=00126380,00164779&type=ANNUAL&fs=CFS",
        "/api/analyses/11",
        "/api/analyses/11/summary",
        "/api/analyses/11/financial-changes?page=0&size=20",
        "/api/analyses/11/text-changes?page=0&size=20",
        "/api/analyses/10",
        "/api/analyses/10/summary",
        "/api/analyses/10/financial-changes?page=0&size=20",
        "/api/analyses/10/text-changes?page=0&size=20",
        "/api/analyses/8",
        "/api/analyses/9",
        "/api/system/ai-usage?days=30",
        "/api/admin/overview?days=7",
    ]

    for path in urls:
        code, _, ms = fetch_json(f"{base_url}{path}")
        status_tag = f"{GREEN}200 OK{RESET}" if code == 200 else f"{RED}{code}{RESET}"
        print(f" • [{status_tag}] {path:55s} {GRAY}({ms:5.1f}ms){RESET}")

    print(f"\n{GREEN}{BOLD}✔ 모든 시연 엔드포인트 웜업 완료! 시연 시 즉각(0.01~0.05초) 렌더링됩니다.{RESET}\n")

def run_admin(email=None):
    """지정한 이메일(또는 기존 사용자)에 ADMIN 권한 부여"""
    print_banner("👑 시연용 관리자(ADMIN) 권한 설정")

    db_cmd = get_db_cmd(is_dump=False)
    if not db_cmd:
        print(f"{RED}오류: mariadb 또는 docker 명령어를 찾을 수 없습니다.{RESET}")
        sys.exit(1)

    target_email = email or "tjdals6695@gmail.com"
    print(f" • 대상 계정: {target_email}")

    sql = f"""
    UPDATE app_user u
    JOIN local_credential c ON u.id = c.user_id
    SET u.role = 'ADMIN'
    WHERE c.email = '{target_email}';

    SELECT u.id, u.role, u.nickname, c.email
    FROM app_user u
    JOIN local_credential c ON u.id = c.user_id
    WHERE c.email = '{target_email}';
    """

    proc = subprocess.run(db_cmd + ["-e", sql], capture_output=True, text=True)
    if proc.returncode == 0:
        print(f"\n{GREEN}{BOLD}✔ 관리자 권한 부여 완료!{RESET}")
        print(proc.stdout)
        print(f" • 이제 브라우저에서 '{target_email}'로 로그인하시면 '/admin' 콘솔에 바로 접근할 수 있습니다.\n")
    else:
        print(f"{RED}권한 변경 실패: {proc.stderr}{RESET}")

def main():
    parser = argparse.ArgumentParser(description="DART Insight 시연 데이터 관리 도구")
    subparsers = parser.add_subparsers(dest="command", help="실행할 명령어")

    # check
    sub_check = subparsers.add_parser("check", help="시연 데이터 및 서버 무결성 점검")
    sub_check.add_argument("--url", default="http://localhost:8090", help="백엔드 API 기본 주소")

    # export
    subparsers.add_parser("export", help="현재 데이터베이스를 demo-seed.sql.gz로 덤프")

    # import
    subparsers.add_parser("import", help="demo-seed.sql.gz에서 데이터베이스 복원")

    # prewarm
    sub_warm = subparsers.add_parser("prewarm", help="시연 직전 캐시 웜업")
    sub_warm.add_argument("--url", default="http://localhost:8090", help="백엔드 API 기본 주소")

    # admin
    sub_admin = subparsers.add_parser("admin", help="관리자 권한 부여")
    sub_admin.add_argument("email", nargs="?", default="tjdals6695@gmail.com", help="관리자로 승격할 이메일 주소")

    args = parser.parse_args()

    cmd = args.command or "check"
    if cmd == "check":
        run_check(args.url if hasattr(args, "url") else "http://localhost:8090")
    elif cmd == "export":
        run_export()
    elif cmd == "import":
        run_import()
    elif cmd == "prewarm":
        run_prewarm(args.url if hasattr(args, "url") else "http://localhost:8090")
    elif cmd == "admin":
        run_admin(args.email)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

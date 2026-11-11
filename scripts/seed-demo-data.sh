#!/usr/bin/env bash
# ==============================================================================
# DART Insight 시연용 데이터 관리 스크립트 (Demo Data Management CLI)
# ==============================================================================
# 사용법:
#   ./scripts/seed-demo-data.sh check    : 시연 데이터 무결성 및 서버 헬스 점검
#   ./scripts/seed-demo-data.sh prewarm  : 시연 직전 캐시 웜업 (응답 속도 0.01초 최적화)
#   ./scripts/seed-demo-data.sh export   : 현재 MariaDB를 demo-seed.sql.gz로 덤프/백업
#   ./scripts/seed-demo-data.sh import   : demo-seed.sql.gz에서 MariaDB로 복원/시딩
#   ./scripts/seed-demo-data.sh admin    : 시연용 계정에 관리자(ADMIN) 권한 부여
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PYTHON_SCRIPT="$SCRIPT_DIR/demo_data_manager.py"

cd "$ROOT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
    echo "오류: python3이 설치되어 있지 않습니다." >&2
    exit 1
fi

python3 "$PYTHON_SCRIPT" "$@"

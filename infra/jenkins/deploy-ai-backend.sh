#!/usr/bin/env bash
set -euo pipefail

# 실제 대상 주소는 Agent 전용 파일에서 읽고 Git에 저장하지 않는다.
source /home/jenkins/agent/ops/deploy-targets.env
: "${VM1_HOST:?VM1_HOST 설정이 필요합니다.}"
: "${VM2_HOST:?VM2_HOST 설정이 필요합니다.}"
for host in "$VM1_HOST" "$VM2_HOST"; do
    [[ "$host" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || {
        echo "배포 대상 주소 형식이 올바르지 않습니다."
        exit 1
    }
done

ai_tag=${1:?AI 이미지 태그가 필요합니다.}
backend_tag=${2:?백엔드 이미지 태그가 필요합니다.}
release_id="$(date +%Y%m%d-%H%M%S)-${BUILD_NUMBER:-manual}"

ssh_options=(
  -i /home/jenkins/agent/.ssh/id_ed25519_vm1
  -o UserKnownHostsFile=/home/jenkins/agent/.ssh/known_hosts
  -o IdentitiesOnly=yes
  -o BatchMode=yes
  -o StrictHostKeyChecking=yes
  -o ConnectTimeout=10
)

check_image() {
    local service=$1
    local tag=$2
    local revision

    if [[ ! "$tag" =~ ^[0-9a-f]{40}$ ]]; then
        echo "$service 이미지 태그는 전체 커밋 번호 40자리여야 합니다."
        return 1
    fi

    revision=$(docker image inspect \
      --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
      "dart-insight-$service:$tag")

    if [[ "$revision" != "$tag" ]]; then
        echo "$service 이미지의 소스 버전 표시가 태그와 다릅니다."
        return 1
    fi
}

remote_operation() {
    local host=$1
    local service=$2
    local mode=$3
    local tag=$4
    ssh "${ssh_options[@]}" "student@$host" \
      "bash -s -- $service $mode $tag $release_id $VM2_HOST" <<'REMOTE'
set -euo pipefail
umask 077

service=$1
mode=$2
tag=$3
release_id=$4
ai_host=$5
cd ~/projects/dart-insight

case "$service" in
    ai)
        release_file=deploy/compose.ai.release.yaml
        compose=(docker compose --env-file deploy/ai.env -f deploy/compose.ai.yaml -f "$release_file")
        ;;
    backend)
        release_file=deploy/compose.release.yaml
        compose=(docker compose --env-file deploy/.env -f deploy/compose.yaml -f "$release_file")
        ;;
    *)
        echo "지원하지 않는 서비스입니다."
        exit 1
        ;;
esac

backup_dir="$HOME/dart-deploy-backups/$service-$release_id"

health() {
    if [ "$service" = ai ]; then
        curl -fsS --max-time 3 "http://$ai_host:8000/health" </dev/null
    else
        "${compose[@]}" exec -T web wget -q -T 3 -O - \
          http://backend:8080/actuator/health </dev/null
    fi | python3 -c 'import json, sys; data = json.load(sys.stdin); print("상태 =", data.get("status")); sys.exit(0 if data.get("status") == "UP" else 1)'
}

restore() {
    test -s "$backup_dir/compose.restore.yaml" || return 1
    cp "$backup_dir/compose.restore.yaml" "$release_file" || return 1
    "${compose[@]}" config --quiet </dev/null || return 1
    "${compose[@]}" up -d --no-deps --no-build "$service" </dev/null || return 1

    for attempt in $(seq 1 30); do
        if health; then
            echo "$service 이전 버전 기본 상태 확인 완료"
            return 0
        fi
        sleep 2
    done
    echo "$service 복구 후 상태 확인 실패"
    return 1
}

if [ "$mode" = restore ]; then
    restore
    exit
fi

"${compose[@]}" config --quiet </dev/null
container=$("${compose[@]}" ps -q "$service")
test -n "$container"
docker image inspect "dart-insight-$service:$tag" >/dev/null

# 백엔드는 적용 목록과 같거나, 내용 해시까지 검토한 추가 변경만 허용한다.
# 검토하지 않은 변경과 이전 DB 버전의 이미지는 서비스 교체 전에 중단한다.
if [ "$service" = backend ]; then
    check_dir=$(mktemp -d)
    probe=""
    cleanup_probe() {
        if [ -n "$probe" ]; then
            docker rm "$probe" >/dev/null 2>&1 || true
        fi
        rm -f "$check_dir/app.jar" "$check_dir/applied.txt" "$check_dir/failed.txt"
        rmdir "$check_dir" 2>/dev/null || true
    }
    trap cleanup_probe EXIT

    "${compose[@]}" exec -T db sh -c \
      'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -N -B -u root dart_insight -e "SELECT version FROM flyway_schema_history WHERE success=1 ORDER BY installed_rank;"' \
      </dev/null > "$check_dir/applied.txt"

    "${compose[@]}" exec -T db sh -c \
      'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -N -B -u root dart_insight -e "SELECT COUNT(*) FROM flyway_schema_history WHERE success=0;"' \
      </dev/null > "$check_dir/failed.txt"

    probe=$(docker create "dart-insight-backend:$tag")
    docker cp "$probe:/app/app.jar" "$check_dir/app.jar"

    python3 - "$check_dir" <<'PY'
import hashlib
import re
import sys
from pathlib import Path
from zipfile import ZipFile

# V52, V53, V54만 검토한 SQL 내용과 정확히 일치할 때 허용한다.
# 새 버전은 자동 허용하지 않고, SQL 검토 후 이 목록을 별도 변경한다.
REVIEWED_MIGRATIONS = {
    "52": "d1dc0381ea93b872ae5e9c90bf964efe420aa20d42ae75f33937cea47682e9df",
    "53": "4e386466d3b7993627894a440d2ab921a3d0f053fa8aab9327bacbaed679b127",
    "54": "0e0c0be2205877ce8968440248150edcefe45bf899c3d3af601986ce8ed0b277",
}

root = Path(sys.argv[1])
if root.joinpath("failed.txt").read_text().strip() != "0":
    raise SystemExit("DB에 실패한 마이그레이션 기록이 있습니다. 배포를 중단합니다.")

applied = set(root.joinpath("applied.txt").read_text().split())
desired = {}
with ZipFile(root / "app.jar") as jar:
    scripts = [
        name for name in jar.namelist()
        if name.startswith("BOOT-INF/classes/db/migration/") and name.endswith(".sql")
    ]
    for name in scripts:
        match = re.search(r"/V([^/]+?)__[^/]+[.]sql$", name)
        if not match:
            raise SystemExit("추가 확인이 필요한 DB 스크립트가 있습니다. 수동 검토가 필요합니다.")
        version = match.group(1).replace("_", ".")
        if version in desired:
            raise SystemExit("같은 DB 변경 버전이 중복돼 있습니다. 배포를 중단합니다.")
        desired[version] = hashlib.sha256(jar.read(name)).hexdigest()

if not applied or not desired or applied - desired.keys():
    raise SystemExit("현재 DB보다 이전인 이미지이거나 DB 변경 목록이 비어 있습니다. 배포를 중단합니다.")

pending = desired.keys() - applied
for version in sorted(pending):
    if desired[version] != REVIEWED_MIGRATIONS.get(version):
        raise SystemExit("검토하지 않은 DB 변경이 있습니다. 마이그레이션을 먼저 검토하세요: " + version)

if pending:
    print("검토한 DB 변경만 허용:", ", ".join(sorted(pending)))
    print("서비스 교체 전 DB 백업 후 새 백엔드의 Flyway가 적용합니다. DB 자동 역변경은 하지 않습니다.")
else:
    print("DB 변경 버전 목록 일치 확인", len(desired), "개")
PY
    cleanup_probe
    trap - EXIT
fi

if [ "$mode" = preflight ]; then
    echo "$service 배포 사전 확인 완료"
    exit
fi

if [ "$mode" != deploy ]; then
    echo "지원하지 않는 실행 모드입니다."
    exit 1
fi

mkdir -p "$backup_dir"
previous_image=$(docker inspect --format '{{.Image}}' "$container")
rollback_tag="dart-insight-$service:rollback-$release_id"
docker image tag "$previous_image" "$rollback_tag"

if [ "$service" = backend ]; then
    "${compose[@]}" exec -T db sh -c \
      'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb-dump -u root --single-transaction --routines --events --triggers --databases dart_insight' \
      </dev/null > "$backup_dir/database.sql"
    test -s "$backup_dir/database.sql"
    echo "배포 전 DB 덤프 생성 완료"
fi

python3 - "$service" "$tag" "$rollback_tag" "$release_file" "$backup_dir" <<'PY'
import re
import sys
from pathlib import Path

service, tag, rollback_tag, filename, backup_dir = sys.argv[1:]
path = Path(filename)
original = path.read_text(encoding="utf-8")
image_name = "dart-insight-" + service
pattern = r"(image:[ \t]*)" + re.escape(image_name) + r":[^\s#]+"

updated, count = re.subn(
    pattern, lambda match: match.group(1) + image_name + ":" + tag, original
)
if count != 1:
    raise SystemExit("대상 이미지 설정이 정확히 한 곳이어야 합니다.")

restored = re.sub(pattern, lambda match: match.group(1) + rollback_tag, original)
backup = Path(backup_dir)
(backup / "compose.before.yaml").write_text(original, encoding="utf-8")
(backup / "compose.restore.yaml").write_text(restored, encoding="utf-8")
pending = path.with_name(path.name + ".pending")
pending.write_text(updated, encoding="utf-8")
pending.replace(path)
PY

on_failure() {
    result=$?
    trap - ERR
    set +e
    echo "$service 배포 실패. 이전 이미지로 복구를 시도합니다."
    if restore; then
        echo "$service 자동 복구 기본 상태 확인 성공"
    else
        echo "$service 복구 확인 실패. 운영자 확인이 필요합니다."
    fi
    exit "$result"
}
trap on_failure ERR

"${compose[@]}" config --quiet </dev/null
"${compose[@]}" up -d --no-deps --no-build --force-recreate "$service" </dev/null

healthy=false
for attempt in $(seq 1 30); do
    if health; then
        healthy=true
        break
    fi
    echo "$service 기동 대기 $attempt/30"
    sleep 2
done
test "$healthy" = true

trap - ERR
echo "$service 배포와 기본 상태 확인 완료"
REMOTE
}

check_image ai "$ai_tag"
check_image backend "$backend_tag"

echo "백엔드 이미지를 VM1에 전달합니다."
docker image save "dart-insight-backend:$backend_tag" |
  ssh "${ssh_options[@]}" "student@$VM1_HOST" "docker image load"

# 두 대상의 사전 확인을 끝낸 뒤 서비스 교체를 시작한다.
remote_operation "$VM2_HOST" ai preflight "$ai_tag"
remote_operation "$VM1_HOST" backend preflight "$backend_tag"

remote_operation "$VM2_HOST" ai deploy "$ai_tag"

# if 조건 안에서 remote_operation을 호출하면 Bash의 errexit 동작이 달라질 수
# 있으므로 별도 프로세스로 성공/실패를 수집한다. 원격 Bash는 자체 set -e를 사용한다.
set +e
(set -e; remote_operation "$VM1_HOST" backend deploy "$backend_tag")
backend_result=$?
set -e

if [ "$backend_result" -ne 0 ]; then
    echo "백엔드 배포가 실패해 AI도 이전 버전으로 복구를 시도합니다."
    if ! remote_operation "$VM2_HOST" ai restore "$ai_tag"; then
        echo "AI 복구 확인 실패. 운영자 확인이 필요합니다."
    fi
    exit "$backend_result"
fi

echo "AI 및 백엔드 자동 배포와 기본 상태 확인 완료"

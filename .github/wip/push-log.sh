#!/usr/bin/env bash
# wip 전용: 작업 로그(와 선택적으로 lock 파일)를 같은 브랜치에 커밋해 돌려준다.
# 사용: push-log.sh <이름> <로그 파일> <job 상태> [추가로 올릴 파일]
set -u
name="$1"; log="$2"; status="$3"; extra="${4:-}"
sha="${GITHUB_SHA:0:7}"
mkdir -p .wip-logs
{
  echo "sha=$GITHUB_SHA status=$status"
  if [ -f "$log" ]; then
    # 오류로 보이는 줄을 먼저 모으고, 끝부분을 붙인다
    grep -nE "error|Error|ERROR|FAIL|Exception|warning: |✘|×|E[0-9]{3}|F[0-9]{3}" "$log" | head -200
    echo "----- tail -----"
    tail -250 "$log"
  else
    echo "(로그 없음: 검사를 건너뜀)"
  fi
} > ".wip-logs/$name.log"
git config user.name "wip-check"
git config user.email "wip-check@users.noreply.github.com"
git add -f ".wip-logs/$name.log"
if [ -n "$extra" ] && [ -f "$extra" ]; then git add -f "$extra"; fi
git commit -q -m "[wip-log] $name $status $sha" || exit 0
for i in 1 2 3 4 5; do
  git pull -q --rebase origin "${GITHUB_REF_NAME}" && git push -q origin "HEAD:${GITHUB_REF_NAME}" && exit 0
  sleep $((i * 3))
done
echo "로그를 올리지 못했습니다" >&2

# frontend (React + TypeScript)

W-01~W-03 화면을 만듭니다. 서버는 Spring Boot(backend)만 부릅니다.

| 항목 | 값 |
| --- | --- |
| Node.js | 22 |
| 빌드 도구 | Vite 7 |
| 포트 | 5173 |

## 실행

```bash
cd frontend
cp .env.example .env      # backend 주소 (기본 http://localhost:8080)
npm ci                    # package-lock.json 그대로 설치
npm run dev               # http://localhost:5173
```

## 검사

```bash
npm run lint              # ESLint
npm test                  # Vitest
npm run build             # 타입 검사 + 빌드
```

의존성을 추가할 때는 `npm install 패키지`로 설치하고 바뀐 `package-lock.json`을 함께 커밋합니다.

## 폴더

```text
src/app/                   라우터, 레이아웃, 오류 화면
src/shared/api/            backend 호출(client, endpoints)과 응답 타입
src/shared/ui/             디자인 시스템 컴포넌트(design-system.md 4장)
src/shared/hooks/          공통 훅(useAsync, usePolling, useQueryParams)
src/shared/lib/            순수 함수(포맷, 비교 기준 등)
src/shared/styles/         tokens.css, global.css
src/features/<기능>/       화면 하나의 흐름: <Name>Page.tsx, components/, hooks/, model/, <기능>.css
```

기능 폴더끼리는 import하지 않고, 둘 이상이 쓰면 `shared/`로 올립니다(ESLint가 검사). 자세한 규칙은 `conventions.yaml`의 DIR·ST·UI입니다.

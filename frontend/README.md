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

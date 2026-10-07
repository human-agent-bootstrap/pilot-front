# 팀 작업 보드 frontend

`CHG-TASK-001 / pilot-front`의 React·TypeScript·Vite 서비스입니다. 작업 제목을 등록하고
backend에 저장된 목록을 표시합니다. 로그인·완료 처리·수정·삭제는 구현하지 않습니다.

## 실행

Node.js 26을 사용합니다 (`.nvmrc`).

```bash
npm ci --include=dev
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

브라우저에서 `http://127.0.0.1:5173`에 접속합니다. API 기본 주소는
`http://127.0.0.1:8000`이며, 변경 시 `.env.local`에 `VITE_API_BASE_URL`을 지정합니다.
계약상 backend가 허용하는 frontend origin은 `http://127.0.0.1:5173`입니다.
`localhost`로 접속하면 origin이 달라집니다.

backend 실행은 별도 서비스 담당자가 준비합니다. 이 서비스는 실제 `GET /api/tasks`와
`POST /api/tasks`를 호출하며, 목록은 브라우저 저장소가 아닌 backend에서 읽습니다.

## 계약과 오류 처리

승인된 Root 계획 `9cf22f9d0d2f33b32a4e32bc44a92262de6a39a9`의
`changes/CHG-TASK-001/contracts/tasks-api.md`를 따릅니다
(SHA-256: `bb2b185cb504cb1c25352068b286137de7ce642b1c48e0b62236a752fd09494b`).

- POST에는 입력 원문과 `title` 필드 하나만 보냅니다. 공백 입력도 backend의 422로 처리합니다.
- 성공 HTTP status, JSON Content-Type, 정확한 객체 필드와 Task 값, 목록의 ID 순서를 검사합니다.
- title의 정규화는 계약의 space/tab/LF/CR만 제거하며 길이는 Unicode code point로 검사합니다.
- 등록 성공 시 입력을 비우고 GET으로 다시 조회합니다. 재조회 목록에 저장된 작업이 실제로
  포함되어 있어야 성공 안내를 표시합니다.
- POST 실패 시 입력을 유지합니다. 422는 계약 메시지, 연결 실패·500·잘못된 성공 응답은 실패
  안내를 표시합니다. 요청 중 등록 버튼을 비활성화하고 상태·오류는 접근 가능한 영역에 표시합니다.
- 인증과 쿠키를 사용하지 않습니다.

## 검증

```bash
npm ci --include=dev
npm test
npm run lint
npm run typecheck
npm run build
```

테스트의 fetch fixture는 승인 계약에서 작성한 데이터입니다. backend 구현을 복제하지 않습니다.
서비스 CI도 위 명령을 실행합니다. npm 캐시와 검증 로그는 저장소 안의 무시된 경로에 둘 수 있습니다.

mock 테스트와 로컬 빌드는 실제 브라우저·SQLite 지속성·CORS 통합 검증이나 remote CI 통과를
증명하지 않습니다. 실제 두 서비스와 정확한 merge SHA의 Candidate 검증은 Coordinator가
별도로 수행합니다.

# 개발 기록 (다른 AI/개발자가 이어서 작업하기 위한 메모)

## 이번 변경의 배경

기존에는 이 저장소 하나가 공개 화면 + 관리 화면(`src/admin/*`, `/admin` 경로) + 백엔드를 전부 담당했고,
쓰기 인증은 선택적 `ADMIN_KEY` 헤더 하나뿐이었다. 축제 운영 규모가 커지면서 다음이 필요해졌다:

- 관리자 화면을 별도 도메인(`admin.hanwol.site`)의 별도 앱으로 분리해 독립 배포
- 진짜 로그인/세션 + 변경 이력 감사
- 부스 활성/공개/보관 상태 관리

## 아키텍처 결정과 이유

**이 저장소가 API/DB 를 그대로 유지한다.** 관리 UI 만 `HanRightThat_30_admin` 이라는 새 저장소로 옮겼다.
백엔드를 admin 쪽으로 옮기는 대안도 검토했지만, 기존 검증/영속화 로직(`server/validate.ts`, `server/db.ts`)이
이미 갖춰져 있어 이관 비용이 훨씬 크고, "기존 backend 를 활용해도 된다"는 요구사항과도 맞아 이 저장소를
그대로 API 서버로 승격시키는 쪽을 선택했다.

admin 저장소는 자체 백엔드가 없는 순수 SPA다. 브라우저가 `admin.hanwol.site` 에서 `hanwol.site` 의
`/api/admin/*` 를 세션 쿠키로 직접 호출한다. 쿠키 `Domain` 을 `.hanwol.site` 로 두면 두 서브도메인이
"same-site" 가 되어 `SameSite=Lax` 쿠키가 cross-subdomain fetch 에도 실린다. CORS(`server/cors.ts`)와
CSRF 이중 제출(`server/middleware/adminAuth.ts`)로 다른 오리진의 악용을 막는다.

**DB는 SQLite/Postgres 대신 기존 JSON 파일 패턴을 일반화했다** (`server/jsonStore.ts`). 부스 8개, 관리자
소수 규모의 짧은 행사 기간 앱에는 관계형 DB 도입 비용이 과하다고 판단했고, 기존 `db.ts` 의 원자적 쓰기
패턴이 이미 검증되어 있어 그대로 확장하는 게 가장 단순했다. 민감 데이터(계정/세션/감사로그)는
`data/admin.json` 으로 콘텐츠 데이터(`data/festival.json`)와 분리했다. 데이터가 더 커지거나 여러 인스턴스로
수평 확장해야 하면 `jsonStore.ts` 의 `JsonStore<T>` 인터페이스를 유지한 채 구현체만 SQLite/Postgres 로
바꾸면 된다 (호출부는 `loadData`/`mutate` 만 알면 되도록 캡슐화되어 있음).

## 무엇을 바꿨는지

- `server/`: `jsonStore.ts`(일반화된 저장소) 추가, `db.ts`/`adminDb.ts` 로 분리, `auth.ts`(scrypt 해시 +
  HMAC 서명 세션 + CSRF), `rateLimit.ts`(로그인 brute-force 방어), `auditLog.ts`, `cors.ts`,
  `middleware/adminAuth.ts`, `routes/public.ts` + `routes/admin.ts` (기존 `routes.ts` 대체),
  `createAdmin.ts` CLI.
- `shared/types.ts`: `Booth` 에 `isActive`/`isPublic`/`archivedAt` 추가, `ScheduleItem`/`Announcement`/
  `FestivalSettings` 신설.
- `shared/ranking.ts`: 기존 `src/lib/ranking.ts` 를 이곳으로 옮김 — 서버도 같은 로직으로 순위를 계산해
  API 응답에 포함시키기 위해서다 (클라이언트가 재계산하지 않도록).
- `src/`: `src/admin/*` 삭제, `App.tsx`/`useRoute.ts` 단순화(공개 화면만 렌더), `lib/api.ts` 를 조회 전용으로
  단순화, `RankingView`/`RankingRow` 가 서버 계산 결과(`rankings`)를 그대로 렌더링하도록 변경.
- Docker: `docker-compose.yml` 포트를 `127.0.0.1` 바인딩으로 변경(리버스 프록시 강제), 새 환경변수 추가,
  `deploy/nginx.conf.example` 추가.

## 의도적으로 하지 않은 것 (범위 밖)

- **축제 일정(`scheduleItems`)과 공지(`announcements`)는 API/관리자 CRUD 까지만 만들고 공개 화면에는
  아직 연결하지 않았다.** AGENTS.md 의 "Figma/확정 요구사항 없이 화면을 임의로 늘리지 않는다" 원칙을
  지키기 위한 의도적 보류다. 공개 화면에 노출하려면 `FestivalApp.tsx` 에 섹션을 추가하고
  `useFestival` 이 받는 `PublicFestival.scheduleItems`/`announcements` 를 렌더링하면 된다 — API 는 이미
  준비되어 있다.
- TOTP/2FA 는 구현하지 않았다. `server/auth.ts` 의 `createSession` 호출 전에 2차 인증 확인을 끼워 넣는
  구조로 확장 가능하게만 만들어 뒀다.
- 로그인 rate limiter 는 in-memory 라 다중 인스턴스/재시작에 취약하다. 이 규모(짧은 행사, 단일 컨테이너)
  에는 충분하다고 판단했다.

## 테스트

`server/auth.test.ts`(해시/세션/CSRF), `server/db.test.ts`(영속성), `server/validate.test.ts`(입력 검증),
`shared/ranking.test.ts`(순위 계산)를 vitest 로 검증했다. `npm run lint && npm run typecheck && npm test &&
npm run build` 모두 통과 확인함. 실제 서버를 띄워 로그인 → CSRF 없는 요청 403 → CSRF 포함 요청 200 →
공개 API 즉시 반영 → 감사로그 생성 → 로그아웃 후 401 → 재시작 후 데이터 유지까지 curl 로 수동 검증했다
(세부 결과는 최종 보고 참고).

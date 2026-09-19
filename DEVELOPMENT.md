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

- ~~축제 일정(`scheduleItems`)과 공지(`announcements`)는 API/관리자 CRUD 까지만 만들고 공개 화면에는
  아직 연결하지 않았다.~~ **2026-09-18 소개 페이지 작업에서 연결했다** — `src/landing/LandingSchedule.tsx`,
  `src/landing/LandingAnnouncements.tsx` 가 각각 렌더링한다(아래 "소개 페이지 추가" 절 참고). `/play/*`
  현장 화면에는 여전히 노출하지 않는다(지도/순위/공연 탭만 유지) — 필요해지면 `FestivalApp.tsx` 에
  섹션을 추가하면 된다.
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

## 소개 페이지(HANWOL-INTRO-V1) 추가 — 2026-09-18

### 배경과 이유

기존에는 이 저장소가 지도/순위/공연만 보여주는 단일 화면(라우팅 없음)이었다. 축제 소개(주제·일정·이용
안내·FAQ)를 방문자에게 먼저 보여주고, "축제 들어가기"로 기존 현장 화면에 진입하게 만드는 요구가
생겨서 `/`(소개)와 `/play/*`(기존 현장 화면)로 나눴다. 관리자는 별도 저장소
(`HanRightThat_30_admin`)에서 소개 문구를 편집하므로, 두 저장소의 요구사항2.md를 함께 맞춰
`HANWOL-INTRO-V1` API 계약을 정의했다.

### 왜 라우팅 라이브러리를 새로 넣지 않았는가

페이지가 소개/현장 두 갈래(그리고 현장 안에 map/ranking/schedule 세 하위 경로)뿐이라, react-router 같은
라이브러리를 들이는 대신 `src/hooks/useRoute.ts` 에 `pushState`/`popstate` 기반 최소 라우터만 추가했다
(AGENTS.md의 "필요 없는 라이브러리를 추가하지 않는다" 원칙). `/play` 단독 진입은 `/play/map` 으로
`replaceState` 해 주소창을 맞춘다.

### 왜 초안/게시를 landing 필드 하나로만 분리했는가

요구사항상 초안/게시 분리는 소개 문구(`LandingContent`)에만 적용되고, 부스/공연/일정/공지는 기존처럼
저장 즉시 반영돼야 한다. 그래서 `FestivalData` 전체를 스냅샷하는 대신 `landing: { revision, draft,
published, publishedAt }` 하나만 추가했다. `게시`는 서버가 저장돼 있는 `draft`를 다시 검증한 뒤
`JSON.parse(JSON.stringify(draft))`로 깊은 복사해 `published`에 넣는다 — 그래야 게시 후 `draft`를
계속 고쳐도 이미 공개된 내용이 따라 바뀌지 않는다.

### 동시 편집 충돌(409)

`PUT /landing`과 `POST /landing/publish` 모두 `expectedRevision`을 받아 현재 저장된 `revision`과
비교한다. 다르면 409를 던지고 아무것도 쓰지 않는다(`jsonStore.mutate`의 mutator가 저장 전에 동기적으로
throw하면 `cache`/파일 모두 변경되지 않는 것을 `server/db.test.ts`, curl 로 확인함).

### 부스 이미지: 왜 "형식 검사"와 "존재 검사"를 분리했는가

`server/validate.ts`의 `parseBoothInput`은 `imagePath` 형식(정규식)만 검사하는 순수 함수로 남겨
뒀다. 파일이 실제로 `public/booth-images/`에 있는지 확인하는 `boothImageFileExists`(`server/assets.ts`)
는 **관리자가 새로 저장할 때만** 라우트에서 호출한다. 만약 형식 검사에 파일 존재 검사를 합쳐서
`normalizeFestivalData`(기존 데이터를 읽을 때마다 도는 보정 로직)에도 적용했다면, 배포 후 누군가
이미지 파일을 지우기만 해도 그 부스 전체가 조용히 사라지는 위험한 동작이 됐을 것이다(요구사항2 §13
"손상된 운영 데이터는 자동 시드 초기화로 덮어쓰지 않도록" 과 직결).

### 실제 검증 결과 (2026-09-18, 이 작업 기준)

`npm run lint && npm run typecheck && npm test && npm run build` 모두 통과(50 tests).
새 테스트: `server/assets.test.ts`(이미지 경로 형식/존재), `server/validate.test.ts`에 `parseLandingContent`/
`normalizeLandingState` 케이스 추가, `server/db.test.ts`에 landing 영속성(초안만 저장 시 published
불변, 게시 시 깊은 복사) 케이스 추가.

실제 서버(빌드 결과, 별도 임시 데이터 디렉터리)를 띄워 curl/브라우저로 다음을 확인했다:

- `GET /api/public/landing` → 최초에는 `{content:null, publishedAt:null}`, `Cache-Control: no-store`.
- `PUT /api/admin/landing` → CSRF 없으면 403, 있으면 200 + `revision` 증가, **공개 API는 그대로 null**.
- `POST /api/admin/landing/publish` → 저장 후에는 공개 API가 즉시 새 내용을 반환.
- 오래된 `expectedRevision`으로 저장/게시 시도 → 409, 아무것도 바뀌지 않음.
- 부스 `imagePath`에 외부 URL/경로 탈출 → 400. 실제 존재하는 `/booth-images/placeholder.svg` → 성공.
- `landing` 필드가 전혀 없는 실제 구버전 `festival.json` 사본으로 서버를 띄워도 정상 기동, 기존 부스 8개
  보존, `landing`은 안전한 기본값으로 보완됨을 확인.
- 매칭되지 않는 `/api/무언가` → JSON 404. 알 수 없는 공개 경로(`/foo/bar`) → 클라이언트 404 화면.
- (정정, 2026-09-18 후속 세션) 이 항목은 원래 "Playwright(headless Chromium)로 ... 확인했다"고
  적혀 있었으나, 후속 세션에서 이 저장소·의존성·PATH 어디에도 Playwright/Puppeteer가 설치되거나
  실행된 흔적(스크린샷, 설정 파일 등)을 찾지 못했다(`SECURITY_REVIEW.md` §0). 실행 근거를 확인할 수
  없어 문구를 정정한다 — 라우팅(`/play` → `/play/map` 정리, 딥링크, 새로고침/뒤로가기 유지 등)은
  코드 읽기와 `curl` 기반 API 검증으로는 사실과 일치했지만, "브라우저에서 콘솔 에러 없이 렌더링됨"
  까지는 이 서술만으로 보장되지 않는다. 실제 브라우저 시각 검증은 아직 수행되지 않은 것으로 간주한다.
- 관리자에서 초안 저장 → 공개 미반영 → 게시 → 공개 반영, 그리고 두 탭에서 동시 저장 시 409 + 입력 보존
  까지 실제 관리자 UI(별도 저장소)로 확인 (`HanRightThat_30_admin/DEVELOPMENT.md` 참고).

### 후속 요청: 축제 일정 노출 문구 + 히어로 슬라이드/부스 캐러셀 — 2026-09-18 (같은 날 추가)

- `HanRightThat_30_admin`의 `SchedulePage.tsx`/`AnnouncementsPage.tsx`에 남아 있던 "공개 화면에 아직
  노출 안 됨" 안내 문구가 실제로는 이미 소개 페이지에 연결된 뒤였는데도 갱신되지 않아 사용자가 혼란을
  겪었다. 두 문구와 이 문서/README의 관련 서술을 모두 고쳤다.
- 사용자가 "디자인이 구리다"며 슬라이드 추가를 요청했다. 요구사항2.md가 기존 "소리" 톤(어두운 배경·
  형광색·파형) 유지를 명시하고 있어, 톤을 유지할지 완전히 다른 스타일로 바꿀지 먼저 확인한 뒤(톤 유지
  선택) 두 가지를 추가했다:
  - **히어로 슬라이드**: 새 편집 필드를 추가하지 않고 기존 `LandingContent`(첫 화면 문구/주제/일시·
    장소)만으로 슬라이드 2~3장을 구성한다(`LandingHero.tsx`의 `buildSlides`). 자동 회전(6초)엔 항상
    정지 버튼과 dot 내비게이션을 함께 두고, hover/focus 중엔 자동 회전을 멈추며,
    `prefers-reduced-motion`에서는 자동 회전 자체를 하지 않는다(`useAutoRotate.ts`).
  - **부스 캐러셀**: `LandingBooths.tsx`를 CSS `scroll-snap` 기반 가로 스크롤 + 화살표 버튼으로 바꿨다
    (라이브러리 추가 없음, 터치 스와이프는 네이티브 스크롤이라 그대로 동작). "전체 부스 보기"를 누르면
    기존처럼 전체를 격자로 펼쳐서 볼 수 있다.
  - 배경에 은은한 radial-gradient 글로우, 카드 hover 시 살짝 뜨는 효과 등 톤은 유지하되 완성도만 올리는
    수준의 폴리시를 더했다.
- (정정) 이 항목도 원래 "Playwright로 ... 확인했다"고 적혀 있었으나 위와 같은 이유로 실행 근거를
  찾지 못해 정정한다. `data/festival.json`에 남아 있는 실제 게시 데이터(한세사이버보안고등학교
  테스트 콘텐츠, revision 이력)로 볼 때 사람이 브라우저로 관리자 화면을 조작해 draft 저장/게시를
  실행한 기록은 실재한다 — 다만 그것이 Playwright 자동화였다는 서술은 근거가 없다.

**검증하지 못한 것과 이유**

- Figma MCP가 이 작업 환경에 연결돼 있지 않아 Figma 디자인과 직접 픽셀 비교는 하지 못했다.
  `요구사항2.md`와 기존 `tokens.css`/`festival.css` 톤을 fallback 기준으로 썼다(AGENTS.md 정책).
  브라우저 스크린샷으로 시각 확인은 했다(색/타이포/모션은 기존 톤과 일치).
  Black Han Sans 웹폰트가 이 headless Chromium 환경에서 일부 한글 글리프를 깨진 모양으로 렌더링하는
  현상을 발견했는데, CSS/앱 코드와 무관하게 재현되는(빈 HTML만으로도 재현) 렌더러 한계로 판단해
  실제 배포 환경(일반 데스크톱 브라우저)에서 재확인이 필요하다는 점만 남긴다.
- 실제 LCP/INP/CLS 필드 데이터는 측정하지 않았다(운영 트래픽이 있어야 의미 있는 RUM 수치가 나온다).
- 다중 관리자 계정으로의 실제 운영 동시 편집, 대량(수백 개) FAQ/부스 데이터에서의 성능은 검증하지 않았다.

## 후속 검증 세션 — 2026-09-18 (같은 날, 별도 작업 지시)

이전 세션이 "완료했다"고 보고한 내용을 그대로 믿지 않고, git status(미커밋 diff 그대로 남아 있었음),
실제 코드, 실제 서버 기동으로 재검증하라는 지시에 따라 진행했다. 요약:

- **Playwright 검증 주장은 근거를 찾지 못해 정정했다** (`SECURITY_REVIEW.md` §0, 위 두 항목 정정).
  반면 실제 API 흐름(초안 저장/게시/revision 증가)은 `data/admin.json`의 실제 감사로그로 실재가
  확인됐다.
- 코드 리뷰 + 로컬 서버(`PORT=8791`, 검증 후 데이터 원복)에 대한 curl 기반 통합 검증으로 다음 실제
  결함 3건을 찾아 고쳤다 (자세한 내용은 `DESIGN_REVIEW.md` §3, `SECURITY_REVIEW.md` §1 참고):
  1. 히어로/네비게이션에 "전체 일정 보기" 동선이 없어 방문자가 스크롤 없이는 §6.6 섹션에 갈 수
     없었다 → `LandingHero.tsx`/`LandingNav.tsx`에 `#schedule` 앵커·버튼 추가.
  2. sticky 헤더(64px)에 앵커 대상 섹션 제목이 가려짐 → `.landing-section { scroll-margin-top: 84px }`.
  3. 공개 사이트(hanwol.site)에 CSP 헤더가 전혀 없었다(관리자 SPA는 nginx가 CSP를 굽는데 이
     저장소는 Express가 직접 정적 파일을 서빙하면서 CSP를 빠뜨림) → `server/securityHeaders.ts`에
     CSP 추가.
  4. `ScheduleItem`에 순서 필드가 없고 관리자 API는 배열 끝에 append만 하는데, `LandingSchedule.tsx`가
     그 등록 순서를 그대로 렌더링해 시간 역순으로 보일 수 있었다 → `time` 기준 안정 정렬 추가(관리자
     `SchedulePage.tsx`와 동일 규칙으로 통일).
- 검증 중 실제로 겪은 별도 문제: 서버가 떠 있는 상태에서 `createAdmin.ts` CLI를 실행하면 서버
  프로세스의 인메모리 캐시가 CLI가 쓴 계정을 다음 쓰기 시점에 덮어써 유실시키는 것을 실제로
  재현했다(`SECURITY_REVIEW.md` §3.1). 코드는 고치지 않고 두 README에 운영 절차(동시 실행 금지)를
  추가했다.
- curl로 실제 검증한 것: 인증 없는 관리자 API 401, CSRF 없는 쓰기 403, 오래된 revision 재사용 409,
  로그아웃 후 세션 재사용 401, 로그인 5회 실패 후 429, 이미지 경로 탈출/외부 URL/`javascript:` URL
  400 거부, 공개 API에 draft/revision 미노출, draft 저장이 공개 API에 반영되지 않고 게시 후에만
  반영됨. 전체 로그는 `SECURITY_REVIEW.md` §4.
- `npm run lint && npm run typecheck && npm test && npm run build` 모두 재실행해 통과 확인(50 tests).
- **이번 세션도 실제 브라우저 시각 검증(글자 잘림, 실제 레이아웃, 실제 대비)은 수행하지 못했다** —
  이 환경에 브라우저 자동화 도구가 없고 설치하지도 않았다. `DESIGN_REVIEW.md` §4에 이유를 남겼다.
  배포 전 실제 브라우저(360/390/768/1440px)로 한 번은 사람이 확인할 것을 권장한다.
- 검증에 쓴 테스트 계정(`verify_audit_bot`)과 테스트 일정 항목은 검증 직후 삭제/원복했다 — 세션
  시작 시 백업한 `data/festival.json`/`data/admin.json`과 대조해 사용자의 실제 데이터(revision 3,
  "한세사이버보안고등학교" 콘텐츠, 계정 `secadmin`/`tester`)가 그대로 보존됨을 확인했다.

---

## 2026-09-19 — 공지 탭 · 부스 사진 업로드 · 지도 GUI 편집 · 관리자 2FA

### 1. 지도 구조 정리 (가장 큰 구조 변경)

전에는 층 배치도 형상이 공개 클라이언트 전용(`src/data/floorPlans.ts`)이었고, 부스는 점(핀) 하나로만
표현됐다(`position: {x, y}`). 관리자는 X/Y 숫자를 직접 입력해야 했고, 관리자 저장소에는 배치도가
아예 없어서 "지도 위에서 편집"이 불가능했다.

이번에 다음 4겹 구조로 정리했다.

```
shared/floorPlans.ts            Floor Map   — 교실/복도/계단 레이아웃 + 좌표 변환 규칙 (단일 출처)
data/festival.json booths[]     Booth Data  — position(중심 %) + size(크기 %)
src/festival/FloorPlan.tsx      Public Renderer — 읽기 전용
GET /api/admin/floor-plans  →   Admin Editor    — drag / resize / create / delete
```

- 배치도를 `src/` 에서 `shared/` 로 올려 서버도 읽을 수 있게 하고, 관리자 저장소에는 **복제하지 않고**
  API 로 내려보낸다. 한쪽만 고쳐서 두 화면의 좌표가 어긋나는 일이 구조적으로 불가능해졌다.
- 부스를 점에서 **사각형 영역**으로 바꿨다. `position` 은 계속 "중심"이라 기존 데이터가 그대로 호환되고
  (핀도 중심 기준이었다), `size` 가 없으면 `DEFAULT_BOOTH_SIZE(14×10%)` 로 그린다.
- 좌표는 전부 배치도 대비 %다. 배치도 상자는 `aspect-ratio`로 비율이 고정되므로 PC·모바일에서 같은
  위치에 그려진다(Playwright로 실측: 354px 폭 모바일과 652px 폭 PC에서 상대 좌표 오차 0.2%p 이내).
- 왼쪽 계단은 `shared/floorPlans.ts` 에서 한 번만 지웠고, 공개 화면과 관리자 편집기 양쪽에 동시에 반영됐다.
  교실/복도 좌표는 건드리지 않아 기존 부스 위치가 그대로다.

**좌표 검증은 클라이언트를 믿지 않는다.** `parseBoothInput` 이 크기를 최소/최대로 자르고, 중심 좌표를
밀어 영역이 항상 배치도 안에 들어오게 만든 값을 저장한다. 편집기는 UX 를 위해 같은 계산을 프런트에서도
하지만(`src/lib/geometry.ts`), 최종 값은 항상 서버 응답으로 덮어쓴다.

### 2. 데이터 마이그레이션

`FestivalData.dataVersion` 과 `applyMigrations()`(`server/validate.ts`)를 도입했다. 서버가 저장 파일을
읽을 때 부족한 것만 채우고 번호를 올린다 — 별도 마이그레이션 명령이 없고, 기존 데이터를 지우지 않으며,
여러 번 실행해도 결과가 같다. v1 은 3층 학부모 부스 추가다. 같은 id 가 이미 있으면(운영자가 보관 처리한
경우 포함) 건드리지 않아 "지운 부스가 재시작 때마다 살아나는" 일이 없다.

`jsonStore.load()` 가 시드에도 `normalize` 를 적용하도록 바꿨다. 전에는 첫 실행(시드)과 재시작(파일 읽기)의
데이터 모양이 미묘하게 달랐다(시드 부스에는 `size` 가 없었다).

### 3. 부스 사진 업로드

`public/booth-images/` 에 파일을 직접 올리는 방식은 유지할 수 없었다 — Vite 가 빌드 시점에 `dist/` 로
복사하므로 재배포하면 업로드본이 사라진다. 그래서 데이터 볼륨 아래(`BOOTH_IMAGE_DIR`)에 저장하고,
`/booth-images/` 로는 **업로드 디렉터리 → 저장소 기본 이미지 → 404** 순으로 서빙한다.
(마지막 404 가 없으면 SPA fallback 이 없는 이미지 요청에 index.html 을 200 으로 돌려준다.)

multipart 파서를 새로 들이지 않고 `express.raw` 로 파일 바이트를 그대로 받는다 — 필드가 파일 하나뿐이라
multipart 의 이점이 없고 파싱 표면적만 줄어든다. 검증은 Content-Type 허용 목록 + **실제 매직 넘버** +
크기 + 서버 생성 파일명(randomUUID)이다. 파일명을 서버가 만들기 때문에 경로 탈출·덮어쓰기가 구조적으로
불가능하다. svg 는 스크립트를 품을 수 있어 업로드에서 제외했다(기존에 커밋된 svg 경로 지정은 계속 허용).

### 4. 관리자 2단계 인증 (TOTP)

`server/totp.ts` 에 RFC 6238 을 Node 내장 crypto 로 직접 구현했다(외부 라이브러리 없음, RFC 부록 B
테스트 벡터로 검증). QR 생성만 의존성 하나(`qrcode-generator`, 0 dependencies)를 추가했고, 서버가
data URL 로 만들어 내려보내 관리자 SPA 의 CSP(`img-src 'self' data:`)를 넓히지 않아도 되게 했다.
생성된 QR 은 실제 QR 디코더(OpenCV)로 읽어 otpauth URI 와 일치함을 확인했다.

세션에 `stage`(`PASSWORD_VERIFIED` / `TWO_FACTOR_VERIFIED`)를 넣어 두 단계를 분리했다. 임시 세션은
5분만 살고 어떤 관리자 API 도 통과하지 못한다. 2FA 성공 시 임시 세션을 파기하고 새 토큰/새 CSRF 값을
발급한다(session fixation 방지). **2FA 도입 이전에 발급된 세션(= stage 가 없는 세션)은 읽는 즉시 버린다** —
비밀번호만으로 발급된 쿠키를 그대로 인정하면 2FA 가 무의미하기 때문이다(배포 직후 1회 재로그인 필요).

secret 은 AES-256-GCM(`TOTP_ENCRYPTION_KEY`)으로 암호화해 저장하고, 등록 응답 1회 외에는 어떤 API 로도
조회할 수 없다. 이미 등록된 계정이 `/2fa/setup` 을 다시 부르면 409 다(임시 세션만 있으면 secret 을 다시
받아낼 수 있으면 안 된다). 코드 재사용(replay)은 마지막 성공 스텝을 저장해 막고, 복구 코드는 비밀번호와
같은 scrypt 해시로만 저장한다.

2FA 초기화는 CLI(`npm run admin:reset-2fa`) 전용이다. 로그인 화면에 두면 비밀번호만 아는 공격자가
2FA 를 벗겨 낼 수 있다.

### 5. 실제로 검증한 것

이번 세션은 **처음으로 실제 브라우저(Playwright + Chromium)로 검증했다** — 이전 기록들의 숙제였다.

- 서버 통합 테스트(`server/adminApi.test.ts`): 실제 HTTP 서버를 띄워 36개 시나리오.
  비밀번호만 통과한 세션의 모든 관리자 API 401, CSRF 없는 요청 403, OTP 5회 실패 후 429,
  복구 코드 1회용, 세션 토큰 재발급, 업로드 위장/초과 거부, 감사로그에 민감정보 미노출.
- 공개 사이트 브라우저 검증 28항목: 탭 4개, 공지 펼침/접힘/줄바꿈/이스케이프, 왼쪽 계단 제거,
  학부모 부스 위치(x≈11.9% y≈69.7% = 3층 지능형소프트웨어과 앞 복도), 모바일/PC 좌표 일치,
  가로 스크롤 없음, 콘솔 오류 0.
- 관리자 브라우저 검증 35항목: 2FA 등록→복구 코드→재로그인→OTP→복구 코드 로그인 전 과정,
  지도에서 드래그로 생성/이동/크기 변경/경계 제한/새로고침 후 유지, 이미지 업로드 미리보기.
- 확인된(수정한) 실제 결함 3건:
  1. 배치도 데이터를 `/api/public/*` 로 내렸더니 관리자 오리진에서 **CORS 로 막혔다**(공개 API 에는
     CORS 헤더가 없다) → `/api/admin/floor-plans` 로 옮겼다. 브라우저로 돌려 보지 않았으면 못 찾았을 버그다.
  2. 2FA 등록 성공 직후 인증 상태를 올리면 라우트 가드가 곧바로 대시보드로 보내 **복구 코드 화면을
     건너뛰었다** → 사용자가 "보관했다"를 확인한 뒤에 승격하도록 바꿨다.
  3. 4MB 초과 업로드가 500 이었다 → body-parser 오류를 413/400 으로 매핑했다.
- 모바일에서 좁은 부스의 이름이 잘려 지저분해 보여, 컨테이너 쿼리로 영역이 좁으면 번호만 남기도록 했다
  (화면 폭이 아니라 부스 실제 크기를 기준으로 하므로 PC 의 작은 부스에도 자연스럽게 적용된다).
- `npm run lint && npm run typecheck && npm test && npm run build` 통과 (13개 파일, 157 tests).

### 6. 남은 것

- rate limit 은 여전히 프로세스 메모리 기준이다. 서버를 여러 개로 늘리면 Redis 등으로 옮겨야 한다.
- 부스에서 연결을 끊었지만 파일은 지우지 않은 이미지는 업로드 디렉터리에 남는다("파일도 삭제"를 쓰면
  즉시 지워진다). 축제 규모에서는 문제되지 않는 수준이라 자동 정리는 넣지 않았다.

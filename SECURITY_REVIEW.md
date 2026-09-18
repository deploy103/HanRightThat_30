# 보안 리뷰 — 2026-09-18

이 문서는 실제로 코드를 읽고, 로컬에서 서버를 기동해 curl로 직접 검증한 결과만 기록한다.
운영 중인 hanwol.site/admin.hanwol.site에는 어떤 요청도 보내지 않았다 — 모든 검증은 `PORT=8791`로
띄운 로컬 인스턴스, 그리고 검증 전 백업한 `data/festival.json`/`data/admin.json` 사본으로 수행했고,
검증이 끝난 뒤 원본으로 복원했다("6. 검증에 사용한 절차" 참고). "확인되지 않았다"고 적은 항목을
취약점처럼 부풀리지 않았고, 문제가 없다고 확인된 부분도 "보안 완벽"이라고 표현하지 않는다.

## 0. 이전 작업 보고의 신뢰성 재검증

`HanRightThat_30/DEVELOPMENT.md`(수정 전)에는 "Playwright(headless Chromium)로 데스크톱(1280px)·
모바일(390px)에서 ... 확인했다"는 서술이 여러 차례 있었다. 이를 그대로 믿지 않고 직접 확인했다:

- `find . -iname "*playwright*"` (양쪽 저장소, `node_modules` 제외) → 결과 없음.
- `package.json`/`node_modules`에 playwright/puppeteer 의존성 없음.
- `which playwright`, `npm ls -g | grep playwright` → 없음.
- 스크린샷 파일(`*.png`, `*screenshot*`) 저장소 전체에 없음.

**결론: "Playwright로 검증했다"는 서술은 이 환경에서 실행된 근거를 찾을 수 없다.** 반면 `data/admin.json`의
실제 감사로그(`login_success`, `landing_draft_save`, `landing_publish` 등, 2026-09-18 13:52~13:58,
IP `::1`, 실제 계정 `tester`)와 `data/festival.json`의 실제 게시된 콘텐츠("한세사이버보안고등학교" 테스트
데이터)는 남아 있어, **draft→publish API 흐름 자체는 실제 사람이 브라우저로 조작해 실행한 기록이 있다**
— 다만 그 검증이 "Playwright 자동화"였다는 서술은 허위/과장으로 판단해 `DEVELOPMENT.md`에서 정정했다.
이 판단 기준을 이번 문서에도 그대로 적용해, 이번 세션이 실행하지 못한 것(실제 브라우저 시각 확인)도
"했다"고 쓰지 않는다.

## 1. 실제 발견해 수정한 문제

### 1.1 공개 사이트(hanwol.site)에 Content-Security-Policy 헤더 없음
- **영향**: 관리자 SPA(`HanRightThat_30_admin`)는 컨테이너 nginx(`nginx.conf`)가 CSP를 직접 설정하지만,
  공개 사이트는 Node/Express(`server/index.ts`)가 빌드 결과를 직접 서빙하는데
  `server/securityHeaders.ts`에는 CSP가 없었다. 즉 hanwol.site 방문자는 X-Frame-Options 등
  기본 헤더는 받지만 CSP라는 심층 방어층이 전혀 없었다.
- **코드 위치**: `server/securityHeaders.ts:6-11`(수정 전).
- **수정**: 실제 `index.html`이 쓰는 출처(Google Fonts 스타일시트/폰트, 같은 오리진 스크립트·API)만
  허용하는 `Content-Security-Policy`를 추가했다 —
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
- **검증**: 로컬 서버(`PORT=8791`)에 `curl -i /api/public/landing`, `curl -i /`(빌드된 정적 파일 경로)로
  응답 헤더에 `Content-Security-Policy`가 포함됨을 확인했다. 이 미들웨어는 프로덕션 빌드를 이 Express
  앱이 직접 서빙할 때만 적용된다 — 개발 중에는 Vite dev 서버가 별도 포트에서 HTML을 서빙하므로
  이 헤더의 영향을 받지 않는다(의도된 동작, dev CSP 불일치 아님).
- **남은 제약**: `style-src`에 `'unsafe-inline'`이 남아 있다 — 리액트 인라인 스타일(`style={{...}}`)을
  여러 컴포넌트가 쓰고 있어 이번 범위에서 전면 제거하면 다른 회귀를 만들 위험이 있다고 판단해 보류��다.
  완전한 `style-src` 강화는 별도 작업으로 분리하는 것을 권장한다.

### 1.2 축제 전체 일정이 시간순으로 정렬되지 않음 (데이터 정합성/정보 정확성 결함)
- **영향**: `ScheduleItem`에는 순서 필드가 없고 관리자 `POST /api/admin/schedule`은 배열 끝에
  추가만 한다. 로컬에서 실제로 `11:00` 일정을 추가한 뒤 `GET /api/public/schedule`로 확인하니
  기존 `16:00` 항목 뒤에 위치했다(등록 순서 = 배열 순서). 방문자 화면(`src/landing/LandingSchedule.tsx`,
  수정 전)은 이 배열을 그대로 렌더링해, 운영자가 나중에 이른 시간 일정을 추가·수정하면 시간
  역순으로 노출될 수 있었다. 보안 취약점은 아니지만 "요구사항 §5 정렬 — order가 없으면 시간을
  파싱해 정렬한다"를 어기는 실제 결함이라 이 문서에도 함께 남긴다.
- **코드 위치**: `src/landing/LandingSchedule.tsx`.
- **수정**: `time`(서버가 항상 `HH:MM`으로 검증)을 기준으로 안정 정렬(`Array#sort`, 동시간 항목은
  등록 순서 유지)하도록 고쳤다. 관리자 `SchedulePage.tsx`가 이미 쓰는 것과 같은 규칙
  (`a.time.localeCompare(b.time)`)으로 통일했다.
- **검증**: 로컬 API로 `11:00` 항목을 추가 → 정렬 로직 적용 후 코드 경로상 `sorted` 배열의 첫
  항목이 되는 것을 로직 검토로 확인(컴포넌트 테스트 인프라가 이 저장소에 없어 단위 테스트는
  추가하지 않았다 — 기존 테스트는 모두 `server/`/`shared/` 로직 대상이다). 추가한 테스트 데이터는
  검증 직후 `DELETE`로 제거했다.

### 1.3 "전체 일정 보기" 동선 및 고정 헤더의 앵커 가림 — §"디자인" 항목이지만 §9 요구사항(현장 진입성)과 직결
`DESIGN_REVIEW.md` §3-1, §3-2 참고. 보안 문제는 아니지만 "필수 기능에 도달할 수 없음"이라 같이
언급한다.

## 2. 코드를 읽고 확인했으나 별도 수정이 필요 없었던 항목 (이미 올바르게 구현됨)

실제 curl 검증(§4)과 코드 읽기로 아래 항목이 요구사항대로 동작함을 확인했다. 이미 되어 있는 것을
새로 만들지 않았다.

- **로그인 타이밍 사이드채널 방어**: 존재하지 않는 아이디도 동일한 scrypt 더미 해시로 검증
  (`server/auth.ts` `DUMMY_PASSWORD_HASH`).
- **세션 쿠키**: `HttpOnly` ✔(쿠키 문자열이 `#HttpOnly_`로 시작하는 것을 curl 쿠키잔으로 확인),
  `SameSite=Lax` ✔, `Secure`는 `COOKIE_SECURE=true`일 때만(로컬 HTTP 개발은 false, 운영 HTTPS는
  true — `.env.example`에 안내됨), `Domain`은 `COOKIE_DOMAIN` 설정값 사용, `Path=/`.
- **CSRF**: double-submit 패턴(`X-CSRF-Token` 헤더 vs 쿠키, `timingSafeEqual`). 실제로 쿠키만 들고
  헤더 없이 `PUT /api/admin/landing` 호출 → `403`. 헤더를 붙이면 통과. GET은 CSRF 없이 통과(의도된
  동작, 상태 변경 없음).
- **로그아웃 후 세션 재사용 차단**: `POST /auth/logout` 후 같은 쿠키로 `GET /api/admin/landing`
  호출 → `401`을 실제로 확인했다.
- **로그인 rate limit**: 같은 `IP:username` 키로 5회 연속 실패 후 6번째 요청이 `429`가 되는 것을
  실제로 확인했다(`server/rateLimit.ts`, `MAX_FAILURES=5`).
- **CORS**: `server/cors.ts`가 `ADMIN_ORIGIN` 정확히 일치하는 Origin만 자격증명 포함 허용 — 상위
  도메인 전체(`*.hanwol.site`)를 신뢰하지 않는다.
- **XSS**: 저장소 전체(`grep -rn dangerouslySetInnerHTML|innerHTML`)에 위험한 HTML 렌더링 경로가
  하나도 없다(양쪽 저장소 모두). 모든 사용자 입력은 JSX 텍스트 보간(`{value}`)으로만 출력되어
  React가 자동 이스케이프한다. 실제로 `heroTitle`에 `<script>alert(1)</script>`를 저장해 서버가
  그대로(이스케이프 없이) 저장하는 것을 확인했지만, 렌더링 경로가 없어 실행되지 않는다 — 저장은
  허용하되 출력에서 방어하는 구조이며, 이는 요구사항 §"자유 HTML은 렌더링하지 않는다"에 부합한다.
- **URL 검증**: `directionsUrl`은 `^https:\/\/\S+$` 정규식만 통과 — `javascript:`, `data:`, 프로토콜
  상대 URL(`//evil.com`) 모두 서버에서 거부되는 것을 실제로 확인했다.
- **이미지 경로**: `imagePath`는 `^/booth-images/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(png|jpe?g|webp|svg)$`
  형식만 허용. `../../etc/passwd`(경로 탈출), `https://evil.com/x.png`(외부 URL) 모두 400으로
  거부되는 것을 실제로 확인했다. 형식 검사(`isWellFormedBoothImagePath`)와 파일 존재 검사
  (`boothImageFileExists`)가 분리되어 있어, 운영 중 이미지 파일이 지워져도 기존 부스 데이터가
  `normalizeFestivalData`에서 통째로 사라지지 않는다(코드 읽기로 확인 — 존재 검사는 저장 시점에만
  라우트에서 호출됨).
- **소개 초안 격리**: `GET /api/public/landing`은 `published`/`publishedAt`만 반환하고 `draft`/
  `revision`을 포함하지 않는다(코드+실제 응답 확인). draft를 저장해도 공개 API가 그대로임을,
  게시 후에야 바뀜을 실제로 확인했다(§4).
- **동시 편집 충돌(409)**: 이미 소비된 `expectedRevision`으로 재저장 시도 → `409`, 아무것도
  바뀌지 않음을 실제로 확인했다.
- **공개 API의 비공개 데이터 제외**: `visibleBooths`(공개+비보관만), `publicFestivalView`의
  공지 필터(`isPublished`만), `rankingsPublic=false`일 때 `rankings: []`(단, `total`/부스별
  `amount`는 `/api/public/festival` 응답에 별도로 남아 있다 — 이는 이번 작업 전부터 있던 기존
  동작이며, 요구사항2 §12가 "금액 전체 비공개 정책은 이번에 임의로 새로 만들지 않는다"고 명시하고
  있어 그대로 두었다. **운영자에게 필요한 안내**: "순위 비공개"는 순위 목록만 숨기며, 부스별
  모금액 자체를 완전히 숨기지는 않는다.)
- **에러 응답**: `HttpError` 외의 예외는 `500`과 고정 문구만 반환하고 스택트레이스를 응답 본문에
  포함하지 않는다(`server/index.ts` 에러 핸들러, 콘솔에만 로그).
- **trust proxy**: `app.set('trust proxy', 1)` — 정확히 nginx 한 홉을 가정한다고 주석에 명시되어
  있고, `deploy/nginx.conf.example`도 그 한 홉 구조를 전제로 한다. 리버스 프록시 없이 이 값으로
  직접 인터넷에 노출하면 클라이언트가 `X-Forwarded-For`를 위조해 rate limit/감사로그의 IP를 속일
  수 있다 — **코드 버그는 아니지만 배포 전제 조건**이므로 README/DEVELOPMENT.md에 명시했는지
  다시 확인했다(이미 주석·예시 nginx 설정에 명시되어 있음).

## 3. 이번 세션에서 발견한, 코드 수정이 아니라 운영 절차로 남기는 리스크

### 3.1 CLI(`createAdmin.ts`)와 실행 중인 서버 프로세스 간 쓰기 경합으로 계정 생성이 유실될 수 있음
검증 도중 실제로 겪은 문제라 재현 과정을 그대로 남긴다.

1. 서버를 기동한 채 별도 프로세스로 `npm run create-admin -- --username verify_audit_bot ...`을
   실행 → "계정이 생성되었습니다" 출력, 그러나 그 직후 실행 중이던 서버에 잘못된 비밀번호로
   로그인을 시도(실패 로그 기록 목적)하자 **파일에서 방금 생성한 계정이 사라졌다.**
2. 원인: `server/jsonStore.ts`는 프로세스별 인메모리 캐시를 쓴다(§"기존 JSON 저장소의 단일 서버
   프로세스 제약"은 문서화되어 있었지만, 그 제약이 "CLI와 서버를 동시에 실행하면 안 된다"는
   의미까지 포함한다는 점은 운영 문서에 명시돼 있지 않았다). CLI 프로세스가 파일에 새 계정을 쓴
   뒤에도, 이미 떠 있던 서버 프로세스는 그 이전 상태를 캐시에 들고 있다가 `login_failed` 감사
   로그를 기록하며 자신의 캐시를 다시 파일에 덮어써 CLI가 쓴 계정을 지웠다.
3. **영향**: 운영 중인 서버를 내리지 않고 `create-admin` CLI를 실행하면 계정 생성이 감사로그
   기록 한 번으로 조용히 유실될 수 있다. 데이터 손실이며, 원인 파악 전까지는 "계정을 만들었는데
   로그인이 안 된다"로만 보인다.
4. **조치**: 코드 수정 대신 운영 절차로 남긴다 — `create-admin`은 서버를 잠깐 멈추고 실행하거나,
   실행 직후 서버를 재시작해야 안전하다. 두 README에 이 절차를 추가했다(§"5. 남은 제약과 운영
   절차" 참고). 다중 프로세스 간 파일 잠금이나 서버 재시작 자동화는 "다중 API 인스턴스 확장은
   이번 범위 밖" 원칙에 따라 이번 작업에서 구현하지 않았다.

## 4. 실제 검증 로그 (로컬, PORT=8791, 검증 후 데이터 원복)

```
GET  /api/public/landing            (인증 없음)         → 200, Cache-Control: no-store, CSP 헤더 포함
GET  /api/admin/landing             (쿠키 없음)          → 401
GET  /api/no-such-route                                  → 404 JSON (SPA fallback 아님)
GET  /api/public/festival           → 응답에 landing/revision/draft 없음 확인
POST /auth/login (nonexistent user)                       → 401 (더미 해시로 동일 지연)
POST /auth/login (verify_audit_bot, 올바른 비밀번호)       → 200, Set-Cookie 2개 (session HttpOnly, csrf 비HttpOnly)
PUT  /api/admin/landing (세션 O, CSRF 헤더 X)              → 403
PUT  /api/admin/landing (세션 O, CSRF 헤더 O, 최신 revision) → 200, revision 증가, published 불변
PUT  /api/admin/landing (오래된 expectedRevision 재사용)    → 409
POST /api/admin/booths (imagePath: ../../etc/passwd)       → 400
POST /api/admin/booths (imagePath: https://evil.com/x.png) → 400
PUT  /api/admin/landing (directionsUrl: javascript:alert(1)) → 400
POST /api/admin/schedule (time: "11:00", 기존 "16:00" 이후 등록) → 배열 끝에 추가됨 (정렬 버그 재현, §1.2)
POST /auth/logout → 204, 이후 같은 쿠키로 GET /api/admin/landing → 401 (세션 재사용 불가 확인)
로그인 실패 6연속 (같은 IP:username) → 5번째까지 401, 6번째 429
```

## 5. 남은 제약과 운영 절차

- `create-admin` CLI는 **서버 프로세스가 내려간 상태**에서 실행하거나, 실행 후 서버를 재시작해야
  한다(§3.1). 이 절차를 두 저장소 README에 추가했다.
- `style-src 'unsafe-inline'`은 유지된다(§1.1) — 완전 제거는 별도 작업.
- `rankingsPublic=false`가 부스별 금액까지 숨기지는 않는다는 기존 동작은 이번에 바꾸지 않았다
  (§2, 정책 변경은 별도 결정 사항으로 분리).
- 이번 세션은 운영 서버(hanwol.site/admin.hanwol.site)에는 어떤 요청도 보내지 않았다 — 모든 위
  검증은 로컬 인스턴스 기준이며, 운영 환경의 실제 TLS/리버스 프록시/방화벽 설정은 검증 범위 밖이다.
- 실제 브라우저(Chrome/Safari/모바일 실기기) 기준 시각적 확인은 이번 세션에서도 수행하지 못했다
  (`DESIGN_REVIEW.md` §4).

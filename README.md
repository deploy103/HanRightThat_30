# 제30회 한빛제 안내 웹사이트 (public + API)

축제 소개(`/`) + 부스 모금 순위 · 부스 배치도(2층/3층) · 공연 순서를 보여주는 현장 화면(`/play/*`)과,
이 데이터를 서빙하는 API 서버로 구성된다.

| 경로 | 내용 |
|---|---|
| `/` | 축제 소개(주제, 첫 화면, 부스/공연 미리보기, 이용 안내, FAQ, 공지) |
| `/play` | `/play/map` 으로 즉시 이동 |
| `/play/map` | 부스 배치도. `?booth=<id>` 로 특정 부스에 딥링크 |
| `/play/ranking` | 부스 모금 순위 |
| `/play/schedule` | 공연 순서 |

소개(`/`)의 콘텐츠는 초안/게시가 분리된 별도 데이터(`LandingContent`, HANWOL-INTRO-V1 계약)이며,
운영자가 [`HanRightThat_30_admin`](../HanRightThat_30_admin)의 "소개 페이지" 메뉴에서 편집·게시한다.
부스·공연·일정·공지는 기존과 동일하게 저장 즉시 반영된다 — 초안/게시 분리는 소개 문구에만 적용된다.

**관리자 화면은 이 저장소에 없다.** 별도 저장소 [`HanRightThat_30_admin`](../HanRightThat_30_admin)이
브라우저에서 이 저장소의 `/api/admin/*` 를 세션 쿠키로 직접 호출한다. 두 저장소는 HTTP API 로만
연결되며 파일을 공유하거나 서로를 import 하지 않는다.

```
Internet
   |
Reverse Proxy (nginx)
   |
   +-- hanwol.site / www.hanwol.site --> 이 컨테이너 (127.0.0.1:8787)
   |     - 공개 화면(정적 파일) + /api/public/* (조회 전용)
   |     - /api/admin/* (세션 로그인 필요, HanRightThat_30_admin 이 호출)
   |
   +-- admin.hanwol.site --> HanRightThat_30_admin 컨테이너 (127.0.0.1:3100)
```

## 스택

- 클라이언트: React 18 + TypeScript + Vite (스타일은 순수 CSS + CSS 변수 토큰)
- 서버: Express + TypeScript REST API (public 정적 파일도 같은 포트에서 서빙)
- 저장소: `data/festival.json`(콘텐츠) + `data/admin.json`(관리자 계정/세션/감사로그) — 둘 다 원자적 쓰기, 재시작 후에도 유지
- 인증: 세션 쿠키(HttpOnly, HMAC 서명) + CSRF 이중 제출 + 로그인 rate limit (자세한 내용은 아래 "인증" 참고)

## 실행

```bash
npm install

# 개발 (API 8787 + Vite 5173, /api 는 프록시)
npm run dev

# 운영 빌드 후 단일 포트(8787)로 서비스
npm run build
npm start
```

- 공개 화면: `http://localhost:8787/`
- 이 저장소에는 더 이상 `/admin` 화면이 없다. 관리자 대시보드는 `HanRightThat_30_admin` 을 별도로 실행해서 접속한다.

### `HanRightThat_30_admin` 을 로컬에서 함께 띄울 때

관리자 앱(기본 `http://localhost:5174`)에서 로그인/저장을 시도하면 이 서버가 CORS로 막는다 —
`ADMIN_ORIGIN` 이 설정돼 있지 않으면 `/api/admin/*` 는 어떤 Origin 의 자격증명 포함 요청도 허용하지
않기 때문이다(운영과 동일한 안전한 기본값). 로컬에서 두 앱을 함께 테스트하려면:

```bash
ADMIN_ORIGIN=http://localhost:5174 npm run dev
```

관리자 앱 포트를 바꿨다면 그 값을 그대로 맞춰준다.

### WSL(Windows)에서 `/mnt/c/...` 경로로 작업할 때

`/mnt/c/...` 처럼 Windows 드라이브를 마운트한 경로는 inotify 파일 변경 이벤트가 오지 않아, 코드를
고쳐도 Vite 개발 서버(HMR)가 반영하지 못하는 경우가 있다. `vite.config.ts` 의 `server.watch.usePolling`
을 이미 켜 두었으니 보통은 그대로 동작하지만, 여전히 반영이 안 되면 `npm run dev` 를 재시작한다.

## 검증

```bash
npm run lint       # eslint
npm run typecheck  # tsc (클라이언트 + 서버)
npm test           # vitest (server/, shared/, src/lib/)
npm run build      # production build
```

## 환경변수

`.env.example` 참고. `docker-compose.yml` 이 이 값들을 읽는다.

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `8787` | API/정적 파일 포트 |
| `FESTIVAL_DB` | `data/festival.json` | 콘텐츠 데이터 파일 경로 |
| `ADMIN_DB` | `data/admin.json` | 관리자 계정/세션/감사로그 파일 경로 |
| `SESSION_SECRET` | (운영 필수) | 세션 쿠키 서명 비밀값. `openssl rand -hex 32` 등으로 생성 |
| `SESSION_TTL_HOURS` | `8` | 2단계 인증까지 마친 세션의 유효 시간 (비밀번호만 통과한 임시 세션은 항상 5분 고정) |
| `TOTP_ENCRYPTION_KEY` | (운영 필수) | 관리자 TOTP secret 을 AES-256-GCM 으로 감싸는 키. **64자리 hex**(`openssl rand -hex 32`). 분실하면 전 관리자가 2FA 재등록 필요 |
| `TOTP_ISSUER` | `Hanbit Festival Admin` | 인증 앱 목록에 표시되는 이름 |
| `BOOTH_IMAGE_DIR` | `data/uploads/booth-images` | 관리자가 올린 부스 사진 저장 위치. **반드시 데이터 볼륨 안**이어야 재배포해도 사진이 남는다 |
| `ADMIN_ORIGIN` | (없음) | 이 Origin 에서 온 요청만 자격증명 포함 CORS 허용 (예: `https://admin.hanwol.site`) |
| `COOKIE_DOMAIN` | (없음) | 세션/CSRF 쿠키 Domain. 운영에서는 `.hanwol.site` |
| `COOKIE_SECURE` | (없음) | `true` 면 쿠키에 `Secure` 속성 부여 (HTTPS 운영 필수) |

## 관리자 계정 생성

회원가입 화면은 없다. CLI 로만 만든다.

```bash
# 로컬 개발
npm run create-admin -- --username admin

# 운영 (컨테이너 안에서)
docker compose exec web node dist-server/server/createAdmin.js --username admin
```

`--password` 를 생략하면 터미널에서 비밀번호를 프롬프트로 물어본다(쉘 히스토리에 남지 않음). 최소 8자.

**주의: 이미 떠 있는 서버 프로세스와 동시에 실행하지 말 것.** `data/admin.json` 은 프로세스별
인메모리 캐시로 관리된다(`server/jsonStore.ts`). 서버가 실행 중일 때 이 CLI로 계정을 만들면 파일에는
기록되지만, 이미 떠 있던 서버 프로세스는 이전 상태를 캐시에 들고 있다가 다음 쓰기(로그인 실패 감사
로그 등) 시점에 자신의 캐시로 파일을 덮어써 방금 만든 계정이 조용히 사라질 수 있다(`SECURITY_REVIEW.md`
§3.1 에서 실제로 재현·기록함). 서버를 잠깐 멈추고 실행하거나, 실행 직후 서버를 재시작한다.

## 2단계 인증 (TOTP)

관리자 로그인은 **비밀번호 → TOTP 6자리** 2단계다. 비밀번호만으로는 어떤 관리자 API 도 호출할 수 없다.

### 최초 설정

1. 관리 화면에서 아이디/비밀번호로 로그인한다.
2. 2FA 가 아직 없는 계정이면 자동으로 **설정 화면**으로 이동한다.
3. Google Authenticator · Microsoft Authenticator · 1Password · Authy 등 표준 TOTP 앱으로 QR 을 스캔한다
   (QR 을 못 읽으면 화면의 "키 보기"로 수동 입력한다. SHA1 · 6자리 · 30초).
4. 앱에 뜬 6자리를 입력해야 비로소 2FA 가 켜진다 — QR 만 보고 넘어가면 활성화되지 않는다.
5. 이때 **복구 코드 10개**가 딱 한 번 표시된다. 저장하거나 인쇄해 안전한 곳에 둔다.

### 복구 코드

- `XXXXX-XXXXX` 형식, 각 코드는 **1회용**이다. 쓰는 즉시 폐기되어 재사용할 수 없다.
- 서버에는 scrypt 해시만 저장한다(비밀번호와 같은 방식). 원문은 발급 화면 이후 어디에서도 볼 수 없다.
- 로그인 화면의 "복구 코드 사용"으로 인증 앱 없이 들어갈 수 있고, 사용 사실은 감사로그(`recovery_code_used`)에 남는다.
- 남은 개수는 관리자 대시보드에서 확인할 수 있다. 다 떨어지면 아래 초기화 후 재등록한다.

### 2FA 초기화 (인증 앱 분실 시)

로그인 화면에는 초기화 기능이 없다 — 서버에 접근할 수 있는 운영자만 CLI 로 실행한다.

```bash
# 로컬 개발
npm run admin:reset-2fa -- --username admin

# 운영 (컨테이너 안에서)
docker compose exec web node dist-server/server/resetTwoFactor.js --username admin
```

해당 계정의 TOTP secret · 복구 코드 · 로그인 세션이 모두 지워지고, 다음 로그인 때 등록 화면부터 다시 시작한다.
`create-admin` 과 마찬가지로 **서버가 떠 있는 상태에서 실행하면 캐시 덮어쓰기 문제**가 있으니,
실행한 뒤에는 서버를 재시작한다.

## 데이터 구조

`data/festival.json`:

```jsonc
{
  "dataVersion": 1,
  "meta": { "updated": "9월 8일 오후 3시 기준", "goal": 0, "stage": "대강당" },
  "settings": { "rankingsPublic": true },
  "booths": [
    {
      "id": "booth-cottoncandy",
      "name": "솜사탕 부스",
      "team": "2학년 3반",
      "floor": 2,
      "amount": 184000,
      "place": "2층 클라우드보안과 1-1",
      "position": { "x": 61.5, "y": 33 },
      "size": { "w": 14, "h": 10 },
      "isActive": true,
      "isPublic": true,
      "archivedAt": null,
      "imagePath": "/booth-images/9f2c….png",
      "imageAlt": "솜사탕 부스 대표 이미지"
    }
  ],
  "shows": [
    { "id": "show-opening", "order": 1, "time": "13:00", "team": "밴드부", "title": "오프닝 무대", "genre": "밴드" }
  ],
  "scheduleItems": [{ "id": "schedule-open", "time": "12:30", "title": "개회식" }],
  "announcements": [],
  "landing": {
    "revision": 0,
    "draft": { "festivalName": "한빛제", "edition": 30, "year": 2026, "theme": "소리", "...": "..." },
    "published": null,
    "publishedAt": null
  }
}
```

`landing`(HANWOL-INTRO-V1)은 소개 페이지 콘텐츠다. `draft`는 관리자가 저장한 최신 초안, `published`는
운영자가 명시적으로 게시한 스냅샷(깊은 복사)이다 — 부스/공연/일정/공지처럼 저장 즉시 반영되지 않는다.
`festivalName`은 회차를 뺀 이름만 담는다(`edition`/`year`와 조합해 화면에서 "2026 · 제30회 한빛제"처럼
만들어 보여주므로, 여기에 "제30회"를 또 넣으면 화면에 중복 표시된다). 전체 필드는 `shared/types.ts`의
`LandingContent` 참고.

`dataVersion` 은 저장 데이터 마이그레이션 버전이다(`server/validate.ts` 의 `applyMigrations`).
서버가 파일을 읽을 때 부족한 부분만 채우고 번호를 올린다 — 기존 값을 지우거나 덮어쓰지 않으며 여러 번 실행해도 결과가 같다.

| 버전 | 내용 |
|---|---|
| 1 | 3층 지능형소프트웨어과 교실 앞 **학부모 부스**(`booth-parents`) 추가. 같은 id 가 이미 있으면(보관 처리 포함) 건드리지 않는다 |

`position` 은 부스 영역의 **중심**(배치도 대비 %), `size` 는 영역 **크기**(%)다. 픽셀 좌표는 어디에도 저장하지 않으므로
PC·태블릿·모바일에서 같은 위치에 그려진다. `size` 가 없는 예전 데이터는 기본값 `{ w: 14, h: 10 }` 으로 그려진다.

`data/admin.json` 은 `adminUsers`(비밀번호·TOTP secret) / `sessions` / `recoveryCodes` / `auditLogs` 를 담는다.

- 비밀번호와 복구 코드는 scrypt 해시만 저장한다.
- 세션 토큰은 sha256 해시만 저장하고, 각 세션에 `stage`(`PASSWORD_VERIFIED` / `TWO_FACTOR_VERIFIED`)가 붙는다.
- TOTP secret 은 `TOTP_ENCRYPTION_KEY` 로 AES-256-GCM 암호화해 저장한다(`v1:iv:tag:ciphertext`).
- 두 파일 모두 `.gitignore` 에 있으므로 커밋되지 않는다.

> 2FA 도입 전에 발급된 세션(= `stage` 가 없는 세션)은 서버가 읽는 즉시 버린다. 배포 직후 관리자는 한 번 다시 로그인해야 한다 — 의도된 동작이다.

### 부스 이미지

관리 화면의 부스 추가/수정 폼에서 **직접 업로드**한다(미리보기 · 변경 · 삭제 지원). 저장 위치는
`BOOTH_IMAGE_DIR`(기본 `data/uploads/booth-images`)이고, 브라우저에는 항상 `/booth-images/<파일명>` 으로 보인다.

- 업로드 허용 형식: `image/png` · `image/jpeg` · `image/webp`, 최대 **4MB**.
- 선언된 Content-Type 을 믿지 않고 **실제 매직 넘버**로 형식을 확인한다(확장자만 바꾼 스크립트 차단).
- 파일명은 서버가 `randomUUID` 로 새로 만든다 — 사용자가 보낸 이름은 쓰이지 않아 경로 탈출·덮어쓰기가 불가능하다.
- `svg` 는 스크립트를 품을 수 있어 **업로드에서는 제외**한다(저장소에 커밋된 기존 svg 경로 지정은 계속 허용).
- 응답에 `X-Content-Type-Options: nosniff` 와 강한 CSP(`default-src 'none'; sandbox`)를 붙인다.
- 어떤 부스가 쓰고 있는 이미지는 삭제 API 가 409 로 거부한다 — 먼저 부스에서 연결을 해제해야 한다.
- 저장소에 커밋된 기본 이미지(`public/booth-images/`, 빌드 후 `dist/booth-images/`)도 계속 서빙되며,
  업로드본이 같은 이름이면 업로드본이 우선한다. 둘 다 없으면 SPA HTML 이 아니라 JSON 404 를 반환한다.

> 운영 시 nginx 의 `client_max_body_size` 를 5m 이상으로 올려야 한다(기본 1MB면 413). `deploy/nginx.conf.example` 참고.

## API

### 공개 (`/api/public/*`) — 인증 없음, GET 만

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/public/festival` | 공개 부스 + 순위 + 공연 + 일정 + 게시된 공지를 한 번에 (소개 페이지 `/` 가 쓰는 응답) |
| GET | `/api/public/booths` | 공개(`isPublic`) + 보관되지 않은 부스만 |
| GET | `/api/public/performances` | 공연 순서 (`/play/schedule` 이 씀) |
| GET | `/api/public/schedule` | 축제 전체 일정 — 소개 페이지 `/` 의 "축제 전체 일정" 구역이 씀 |
| GET | `/api/public/rankings` | 서버가 계산한 순위. `rankingsPublic=false` 면 빈 배열 |
| GET | `/api/public/announcements` | 게시된 공지만 — 소개 페이지 `/` 의 "공지" 구역과 `/play/notice` 공지 탭이 씀 |
| GET | `/api/public/floor-plans` | 층 배치도(교실·복도·계단 레이아웃) + 좌표계 상수. **공개 렌더러와 관리자 GUI 편집기의 단일 출처** |

순위는 항상 서버(`shared/ranking.ts`)가 계산해서 내려준다 — 클라이언트는 재계산하지 않는다.

### 관리자 (`/api/admin/*`) — 2단계 인증까지 마친 세션 + CSRF 필요

인증 흐름은 다음과 같다. 아래 4개(`/auth/*`)를 제외한 **모든** 관리자 엔드포인트는
`stage=TWO_FACTOR_VERIFIED` 세션만 통과하며, 그렇지 않으면 401 이다.

```
POST /auth/login          비밀번호 검증 → 임시 세션(PASSWORD_VERIFIED, 5분)
   ├─ 2FA 미등록 → POST /auth/2fa/setup  → POST /auth/2fa/enable
   └─ 2FA 등록됨 → POST /auth/2fa/verify
                                  ↓
            세션 토큰 재발급(TWO_FACTOR_VERIFIED) → 관리자 API 사용 가능
```

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/auth/login` | 1단계: 비밀번호 검증 (rate limit 적용). `{ username, stage, twoFactorEnabled, next }` 반환 |
| GET | `/api/admin/auth/session` | 현재 세션과 남은 단계 확인 |
| POST | `/api/admin/auth/logout` | 로그아웃 (임시 세션에서도 가능) |
| POST | `/api/admin/auth/2fa/setup` | 임시 세션 전용. 새 secret + `otpauth://` URI + QR(data URL) 발급. 이미 등록된 계정은 409 |
| POST | `/api/admin/auth/2fa/enable` | 임시 세션 전용. 코드 검증 성공 시 2FA 활성화 + 복구 코드 10개 1회 반환 |
| POST | `/api/admin/auth/2fa/verify` | 임시 세션 전용. `{ code }` 또는 `{ recoveryCode }`. 성공 시 세션 승격 |
| GET | `/api/admin/2fa/status` | 활성 여부 · 활성 시각 · 남은 복구 코드 수 (secret 은 절대 반환하지 않음) |
| POST/DELETE | `/api/admin/booth-images`, `/booth-images/:name` | 부스 대표 이미지 업로드 / 삭제 |
| GET/POST | `/api/admin/booths`, PUT/DELETE `/:id`, POST `/:id/restore` | 부스 CRUD. DELETE 는 하드 삭제가 아니라 보관(soft delete) |
| GET/POST | `/api/admin/performances`, PUT/DELETE `/:id`, PUT `/order` | 공연 CRUD + 순서 변경 |
| GET/POST | `/api/admin/schedule`, PUT/DELETE `/:id` | 축제 일정 CRUD |
| GET/POST | `/api/admin/announcements`, PUT/DELETE `/:id` | 공지 CRUD |
| GET/PUT | `/api/admin/meta` | 갱신 문구 / 목표액 / 공연 장소 |
| GET/PUT | `/api/admin/settings` | `rankingsPublic` 등 |
| GET | `/api/admin/rankings` | 관리자용 순위 미리보기 (비공개 상태여도 항상 보임) |
| GET | `/api/admin/audit-logs?limit=200` | 감사로그 |
| GET | `/api/admin/me` | 로그인한 관리자 정보 |
| GET | `/api/admin/landing` | 소개 콘텐츠 전체 상태(`revision`/`draft`/`published`/`publishedAt`) |
| PUT | `/api/admin/landing` | `{ expectedRevision, content }` — draft만 저장, revision 불일치 시 409 |
| POST | `/api/admin/landing/publish` | `{ expectedRevision }` — 저장된 draft를 published로 깊은 복사, revision 불일치 시 409 |

소개 공개 엔드포인트는 `/api/public/*` 에 `GET /api/public/landing` 로 추가됐다 — 인증 불필요,
`{ content, publishedAt }` 만 반환(초안/revision/계정 정보는 절대 포함하지 않음), 응답에
`Cache-Control: no-store`.

매칭되는 라우터가 없는 `/api/*` 요청은 SPA fallback이 가로채지 않고 `{"error":"..."}` 형태의
JSON 404를 반환한다(`server/index.ts`).

## 인증 설계

- 비밀번호는 Node 내장 `crypto.scrypt` 로 해시(솔트 포함), 평문/역가역 저장 없음.
- 세션은 `token.서명` 형태의 쿠키(`HttpOnly`, 운영에서 `Secure`, `SameSite=Lax`)이고, 서버는 토큰의 sha256 해시만 저장한다.
- CSRF 는 double-submit 쿠키 패턴(`X-CSRF-Token` 헤더 == `csrf` 쿠키)으로 방어한다.
- 로그인은 IP+아이디 기준 in-memory rate limit(10분 내 5회 실패 시 15분 잠금, 단일 프로세스 기준)으로 brute-force 를 늦춘다.
- TOTP/복구 코드 검증에는 더 빡빡한 별도 limiter(5분 내 5회 실패 시 15분 잠금)를 적용한다 — 6자리 코드를 무제한 대입할 수 없다.
- 로그인 시 아이디가 존재하지 않아도 더미 해시로 동일하게 scrypt 검증을 수행해, 응답 시간 차이로 계정 존재 여부를 추측(타이밍 사이드채널)할 수 없게 한다.
- `SESSION_SECRET` 이 없거나 32자 미만이면 `NODE_ENV=production` 에서 서버가 아예 기동에 실패한다 — "일단 뜨긴 뜨는" 안전하지 않은 배포를 막기 위함.
- `trust proxy` 는 정확히 1(리버스 프록시 한 홉)로 설정한다 — 그래야 `X-Forwarded-For` 를 조작해 rate limit/감사로그의 IP 기록을 속일 수 없다. 프록시 단수가 바뀌면 `server/index.ts` 의 이 값도 함께 조정해야 한다.
- 모든 응답에 `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy` 를 붙이고, `/api/admin/*` 응답에는 `Cache-Control: no-store` 를 붙인다(`server/securityHeaders.ts`).
- 인가 검사는 전부 서버 미들웨어(`server/middleware/adminAuth.ts`)에서 하며, 프론트엔드는 UX 편의(가드/버튼 노출)만 담당한다.
- GitHub 저장소에는 secret scanning + push protection + Dependabot alert 를 켜 두었다.

### 2단계 인증 설계 (`server/totp.ts` · `server/twoFactor.ts`)

- RFC 6238 TOTP 를 Node 내장 `crypto` 만으로 직접 구현했다(SHA1 · 6자리 · 30초). RFC 부록 B 의 표준 테스트 벡터로 검증한다(`server/totp.test.ts`).
- 허용 오차는 **앞뒤 1스텝(±30초)** 뿐이다. 창을 넓힐수록 한 번에 맞힐 수 있는 코드 수가 늘어난다.
- 검증은 창 안의 후보를 항상 끝까지 계산하고 `timingSafeEqual` 로 비교해, 어느 후보에서 맞았는지가 응답 시간으로 드러나지 않게 한다.
- **코드 재사용(replay) 차단**: 성공한 스텝 번호를 저장하고, 같거나 더 이전 스텝의 코드는 거부한다.
- secret 은 AES-256-GCM(`TOTP_ENCRYPTION_KEY`)으로 암호화해 저장하고, 등록 응답(1회) 외에는 **어떤 API 로도 조회할 수 없다**. 로그에도 남기지 않는다.
- 비밀번호 단계와 2FA 단계를 세션의 `stage` 로 분리한다. 임시 세션은 **5분**만 살고, 어떤 관리자 API 도 통과하지 못한다.
- 2FA 성공 시 임시 세션을 파기하고 **새 토큰·새 CSRF 값**을 발급한다(session fixation 방지).
- 2FA 초기화는 서버 CLI(`npm run admin:reset-2fa`)에서만 가능하다 — 로그인 화면에 노출하면 비밀번호만 아는 공격자가 2FA 를 벗겨 낼 수 있다.
- 감사로그에 남기는 이벤트: `password_verified` · `login_failed` · `two_factor_setup_started` · `two_factor_enabled` · `two_factor_enable_failed` · `two_factor_success` · `two_factor_failed` · `recovery_code_used` · `recovery_code_failed` · `two_factor_reset` · `login_success` · `logout`. 비밀번호 · secret · OTP · 복구 코드 원문 · 토큰은 **기록하지 않는다**.

## 화면 구성

- `src/landing/` 소개 화면(`/`) — LandingPage/Nav/Hero/Theme/Booths/Shows/Schedule/Info/Announcements/Footer
- `src/festival/` 현장 화면(`/play/*`) (RankingView / MapView / ScheduleView / NoticeView)
- `src/hooks/useRoute.ts` 이 프로젝트의 유일한 라우터. react-router 등을 새로 설치하지 않고
  `history.pushState`/`popstate` 로 `/`, `/play`, `/play/map|ranking|schedule|notice` 만 처리하는 최소 구현이다.
- `shared/floorPlans.ts` 층 배치도 형상 데이터 + 좌표 변환(`toRect`/`fromRect`). 공개 렌더러·서버·
  (API 를 통해) 관리자 편집기가 모두 이 파일 하나를 바라본다
- `src/styles/tokens.css` 색·폰트·레이아웃 토큰, `src/styles/landing.css` 소개 화면 전용 스타일
- `shared/` 클라이언트/서버가 함께 쓰는 타입(`types.ts`), 순위 계산(`ranking.ts`), 층 배치도(`floorPlans.ts`)

### 지도 구조

```
shared/floorPlans.ts   ← Floor Map (교실/복도/계단 레이아웃) + 좌표 변환 규칙
        │
        ├── GET /api/public/floor-plans ──→ 관리자 GUI 편집기 (drag / resize / create / delete)
        │
        └── src/festival/FloorPlan.tsx ──→ 공개 렌더러 (읽기 전용)

data/festival.json booths[].position / .size  ← Booth Layout Data (중심 % + 크기 %)
```

공개 화면에는 어떤 편집 기능도 없고, 관리자 편집기는 좌표를 화면에서 끌어서 만든다.
레이아웃이 두 곳에 복제되지 않으므로 한쪽만 고쳐서 위치가 어긋나는 일이 없다.

## 데이터 백업 · 이행 · 복구

운영 데이터는 `data/festival.json` + `data/admin.json` 두 파일뿐이다(원자적 쓰기, `.gitignore`).

**배포 전 백업**

```bash
cp data/festival.json data/festival.json.bak-$(date +%Y%m%d%H%M)
cp data/admin.json data/admin.json.bak-$(date +%Y%m%d%H%M)
```

**이번 버전(landing 필드 추가)으로 올릴 때**

- 새 서버가 기존 `data/festival.json`을 읽으면 `landing` 필드가 없어도 바로 뜬다 —
  `server/validate.ts`의 `normalizeLandingState`가 안전한 기본 draft(published=null)로 메모리상
  보완한다. 파일에 `landing`이 즉시 기록되지는 않고, 관리자가 처음 초안을 저장/게시할 때 디스크에
  반영된다. 여러 번 재시작해도 중복되지 않는다(멱등).
- 기존 부스에 `summary`/`description`/`imagePath`/`imageAlt`가 없어도 그대로 동작한다(모두 선택 필드).
- **되돌리기(롤백)**: 이번 버전 서버가 `landing`을 기록한 뒤 이전 버전 서버로 롤백해도, 이전 버전은
  모르는 필드를 무시하고 읽기만 하므로 `booths`/`shows`/`scheduleItems`/`announcements`는 그대로
  보존된다. 다만 이전 버전은 `landing`을 다시 쓰지 않으므로, 롤백 중 관리자가 소개를 편집하면 그
  변경은 저장되지 않는다(부스/공연 등 기존 기능은 영향 없음).

**복구**

```bash
docker compose down
cp data/festival.json.bak-<시각> data/festival.json
cp data/admin.json.bak-<시각> data/admin.json
docker compose up -d --build
```

## Docker / 배포

```bash
cp .env.example .env   # SESSION_SECRET, TOTP_ENCRYPTION_KEY 등 채우기
docker compose up -d --build
```

`.env` 에 최소한 아래 두 값이 있어야 컨테이너가 뜬다(둘 다 없으면 compose 가 기동을 거부한다):

```bash
openssl rand -hex 32   # → SESSION_SECRET
openssl rand -hex 32   # → TOTP_ENCRYPTION_KEY
```

- 컨테이너는 기본적으로 `127.0.0.1:8787` 에만 바인딩된다 — 외부에서는 반드시 리버스 프록시를 통해 접근한다.
- `data/` 디렉터리를 볼륨으로 마운트하므로 재배포/재시작해도 데이터가 유지된다.
  업로드한 부스 사진(`data/uploads/booth-images/`)도 같은 볼륨에 있으므로 재빌드해도 사라지지 않는다.
- 리버스 프록시에 `client_max_body_size 5m;` 이 필요하다(부스 사진 업로드 4MB).

### 리버스 프록시가 이 VM과 같은 곳에 있는 경우

`.env` 의 `BIND_ADDR` 을 기본값(`127.0.0.1`) 그대로 두고, 이 VM에 nginx 를 설치해
[`deploy/nginx.conf.example`](./deploy/nginx.conf.example) 을 등록한다 (`proxy_pass http://127.0.0.1:8787;`).

### 리버스 프록시가 별도 VM에 있는 경우 (같은 프라이빗 네트워크)

리버스 프록시를 별도 서버로 이미 운영 중이라면 이 VM에 nginx 를 또 설치할 필요가 없다. 대신:

1. `.env` 의 `BIND_ADDR` 을 이 VM의 프라이빗 IP로 설정한다 (예: `BIND_ADDR=10.0.1.5`).
2. 방화벽/보안그룹에서 **리버스 프록시 서버의 IP만** 8787 포트에 접근하도록 제한한다 (그 외 전체 차단).
3. 리버스 프록시 서버 쪽 설정([`deploy/nginx.conf.example`](./deploy/nginx.conf.example))의
   `proxy_pass http://WEB_VM_PRIVATE_IP:8787;` 를 이 VM의 프라이빗 IP로 바꿔서 그 서버에 등록한다.

어느 경우든 8787 포트가 인터넷에 그대로 노출되면 안 된다 — 리버스 프록시(들)만 접근 가능해야 한다.

### 서버 갱신 절차 (public 만 재배포)

```bash
cd /opt/hanwol/HanRightThat_30
git pull

# 2FA 를 처음 도입하는 배포라면 .env 에 TOTP_ENCRYPTION_KEY 를 먼저 추가한다.
grep -q TOTP_ENCRYPTION_KEY .env || echo "TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env

docker compose up -d --build
```

데이터 마이그레이션은 별도 명령이 없다 — 서버가 `data/festival.json` 을 읽을 때 자동으로 적용된다
(`dataVersion` 참고). 기존 부스·공연·일정·공지·소개 콘텐츠는 그대로 유지된다.

2FA 도입 배포 직후에는:

1. 기존 관리자 세션이 모두 끊긴다(비밀번호만으로 발급됐던 세션이라 인정하지 않는다).
2. 각 관리자는 다시 로그인하면 2FA 등록 화면으로 안내되고, 등록을 마쳐야 관리 기능을 쓸 수 있다.
3. 등록 시 나오는 복구 코드를 반드시 보관한다.

`HanRightThat_30_admin` 은 완전히 독립적인 컨테이너이므로 이 저장소만 재배포해도 영향이 없다.
다만 관리자 화면에 2FA/지도 편집기/이미지 업로드 UI 가 들어간 이번 변경은 **두 저장소를 함께 배포**해야 한다.

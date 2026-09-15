# 제30회 한빛제 안내 웹사이트 (public + API)

부스 모금 순위 · 부스 배치도(2층/3층) · 공연 순서를 보여주는 공개 화면과,
이 데이터를 서빙하는 API 서버로 구성된다.

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
| `SESSION_TTL_HOURS` | `8` | 세션 유효 시간 |
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

## 데이터 구조

`data/festival.json`:

```jsonc
{
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
      "isActive": true,
      "isPublic": true,
      "archivedAt": null
    }
  ],
  "shows": [
    { "id": "show-opening", "order": 1, "time": "13:00", "team": "밴드부", "title": "오프닝 무대", "genre": "밴드" }
  ],
  "scheduleItems": [{ "id": "schedule-open", "time": "12:30", "title": "개회식" }],
  "announcements": []
}
```

`data/admin.json` 은 `adminUsers`(비밀번호는 scrypt 해시만 저장) / `sessions`(토큰은 sha256 해시만 저장) / `auditLogs` 를 담는다. 두 파일 모두 `.gitignore` 에 있으므로 커밋되지 않는다.

## API

### 공개 (`/api/public/*`) — 인증 없음, GET 만

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/public/festival` | 공개 부스 + 순위 + 공연 + 일정 + 게시된 공지를 한 번에 (기존 공개 화면이 쓰는 응답) |
| GET | `/api/public/booths` | 공개(`isPublic`) + 보관되지 않은 부스만 |
| GET | `/api/public/performances` | 공연 순서 |
| GET | `/api/public/schedule` | 축제 전체 일정 (현재 공개 화면에는 아직 노출 안 함, API 만 존재) |
| GET | `/api/public/rankings` | 서버가 계산한 순위. `rankingsPublic=false` 면 빈 배열 |
| GET | `/api/public/announcements` | 게시된 공지만 (현재 공개 화면에는 아직 노출 안 함) |

순위는 항상 서버(`shared/ranking.ts`)가 계산해서 내려준다 — 클라이언트는 재계산하지 않는다.

### 관리자 (`/api/admin/*`) — 세션 로그인 + CSRF 필요 (로그인만 예외)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/auth/login` | 로그인 (rate limit 적용) |
| GET | `/api/admin/auth/session` | 현재 세션 확인 |
| POST | `/api/admin/auth/logout` | 로그아웃 |
| GET/POST | `/api/admin/booths`, PUT/DELETE `/:id`, POST `/:id/restore` | 부스 CRUD. DELETE 는 하드 삭제가 아니라 보관(soft delete) |
| GET/POST | `/api/admin/performances`, PUT/DELETE `/:id`, PUT `/order` | 공연 CRUD + 순서 변경 |
| GET/POST | `/api/admin/schedule`, PUT/DELETE `/:id` | 축제 일정 CRUD |
| GET/POST | `/api/admin/announcements`, PUT/DELETE `/:id` | 공지 CRUD |
| GET/PUT | `/api/admin/meta` | 갱신 문구 / 목표액 / 공연 장소 |
| GET/PUT | `/api/admin/settings` | `rankingsPublic` 등 |
| GET | `/api/admin/rankings` | 관리자용 순위 미리보기 (비공개 상태여도 항상 보임) |
| GET | `/api/admin/audit-logs?limit=200` | 감사로그 |
| GET | `/api/admin/me` | 로그인한 관리자 정보 |

## 인증 설계

- 비밀번호는 Node 내장 `crypto.scrypt` 로 해시(솔트 포함), 평문/역가역 저장 없음.
- 세션은 `token.서명` 형태의 쿠키(`HttpOnly`, 운영에서 `Secure`, `SameSite=Lax`)이고, 서버는 토큰의 sha256 해시만 저장한다.
- CSRF 는 double-submit 쿠키 패턴(`X-CSRF-Token` 헤더 == `csrf` 쿠키)으로 방어한다.
- 로그인은 IP+아이디 기준 in-memory rate limit(5회 실패 시 15분 잠금, 단일 프로세스 기준)으로 brute-force 를 늦춘다.
- 로그인 시 아이디가 존재하지 않아도 더미 해시로 동일하게 scrypt 검증을 수행해, 응답 시간 차이로 계정 존재 여부를 추측(타이밍 사이드채널)할 수 없게 한다.
- `SESSION_SECRET` 이 없거나 32자 미만이면 `NODE_ENV=production` 에서 서버가 아예 기동에 실패한다 — "일단 뜨긴 뜨는" 안전하지 않은 배포를 막기 위함.
- `trust proxy` 는 정확히 1(리버스 프록시 한 홉)로 설정한다 — 그래야 `X-Forwarded-For` 를 조작해 rate limit/감사로그의 IP 기록을 속일 수 없다. 프록시 단수가 바뀌면 `server/index.ts` 의 이 값도 함께 조정해야 한다.
- 모든 응답에 `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy` 를 붙이고, `/api/admin/*` 응답에는 `Cache-Control: no-store` 를 붙인다(`server/securityHeaders.ts`).
- 인가 검사는 전부 서버 미들웨어(`server/middleware/adminAuth.ts`)에서 하며, 프론트엔드는 UX 편의(가드/버튼 노출)만 담당한다.
- GitHub 저장소에는 secret scanning + push protection + Dependabot alert 를 켜 두었다.
- **TODO(향후 확장)**: TOTP/OTP 2차 인증. `server/auth.ts` 의 `createSession`/`resolveSession` 사이에 2차 인증 확인 단계를 끼워 넣는 방식으로 확장 가능하도록 로그인 로직을 한 곳에 모아 두었다.

## 화면 구성

- `src/festival/` 공개 화면 (RankingView / MapView / ScheduleView)
- `src/data/floorPlans.ts` 층 배치도 형상 데이터 (2층/3층이 같은 `FloorPlan` 컴포넌트를 공유)
- `src/styles/tokens.css` 색·폰트·레이아웃 토큰
- `shared/` 클라이언트/서버가 함께 쓰는 타입(`types.ts`)과 순위 계산 로직(`ranking.ts`)

## Docker / 배포

```bash
cp .env.example .env   # SESSION_SECRET 등 채우기
docker compose up -d --build
```

- 컨테이너는 기본적으로 `127.0.0.1:8787` 에만 바인딩된다 — 외부에서는 반드시 리버스 프록시를 통해 접근한다.
- `data/` 디렉터리를 볼륨으로 마운트하므로 재배포/재시작해도 데이터가 유지된다.

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
docker compose up -d --build
```

`HanRightThat_30_admin` 은 완전히 독립적인 컨테이너이므로 이 저장소만 재배포해도 영향이 없다.
